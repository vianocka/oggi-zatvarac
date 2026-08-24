package app.vercel.oggizatvarac.webview

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.Intent
import android.content.SharedPreferences
import android.os.Bundle
import android.text.InputType
import android.view.ViewGroup
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

private const val APP_HOST = "oggi-zatvarac.vercel.app"
private const val BASE_URL = "https://$APP_HOST/"

// The access code (see src/proxy.ts / APP_ACCESS_KEY on Vercel) is entered
// once by whoever sets up the device and kept only in Keystore-backed
// EncryptedSharedPreferences - never in source, so a shared or decompiled
// APK carries no secret. The server exchanges it for a long-lived cookie on
// first load, so this prompt only reappears if that access is ever revoked
// (e.g. the key gets rotated) - a 404 for the main page clears the stored
// value and asks again.
private const val PREFS_FILE = "secure_prefs"
private const val PREF_ACCESS_KEY = "access_key"

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private lateinit var prefs: SharedPreferences

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val masterKey = MasterKey.Builder(this)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        prefs = EncryptedSharedPreferences.create(
            this,
            PREFS_FILE,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )

        webView = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest,
                ): Boolean {
                    if (request.url.host == APP_HOST) {
                        return false
                    }
                    // Links to other domains open in an external browser instead of this app.
                    startActivity(Intent(Intent.ACTION_VIEW, request.url))
                    return true
                }

                override fun onReceivedHttpError(
                    view: WebView,
                    request: WebResourceRequest,
                    errorResponse: WebResourceResponse,
                ) {
                    super.onReceivedHttpError(view, request, errorResponse)
                    // Only the top-level page 404-ing means "the access code
                    // no longer works" - a missing image/subresource doesn't.
                    if (request.isForMainFrame && errorResponse.statusCode == 404) {
                        runOnUiThread {
                            prefs.edit().remove(PREF_ACCESS_KEY).apply()
                            promptForAccessCode(retry = true)
                        }
                    }
                }
            }
            webChromeClient = WebChromeClient()
        }

        if (BuildConfig.DEBUG) {
            WebView.setWebContentsDebuggingEnabled(true)
        }

        setContentView(webView)

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    if (webView.canGoBack()) {
                        webView.goBack()
                    } else {
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                    }
                }
            },
        )

        val storedKey = prefs.getString(PREF_ACCESS_KEY, null)
        if (storedKey != null) {
            loadApp(storedKey)
        } else {
            promptForAccessCode(retry = false)
        }
    }

    private fun loadApp(accessKey: String) {
        webView.loadUrl("$BASE_URL?key=$accessKey")
    }

    private fun promptForAccessCode(retry: Boolean) {
        val input = EditText(this).apply {
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
            hint = "Prístupový kód"
        }
        AlertDialog.Builder(this)
            .setTitle("Prístupový kód")
            .setMessage(
                if (retry) {
                    "Kód nie je platný. Skúste to znova."
                } else {
                    "Zadajte prístupový kód pre Oggi Zatvárač."
                }
            )
            .setView(input)
            .setCancelable(false)
            .setPositiveButton("Pokračovať") { _, _ ->
                val value = input.text.toString().trim()
                if (value.isEmpty()) {
                    promptForAccessCode(retry = false)
                } else {
                    prefs.edit().putString(PREF_ACCESS_KEY, value).apply()
                    loadApp(value)
                }
            }
            .show()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
