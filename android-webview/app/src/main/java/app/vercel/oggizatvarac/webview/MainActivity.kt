package app.vercel.oggizatvarac.webview

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.Intent
import android.content.SharedPreferences
import android.os.Bundle
import android.text.InputType
import android.view.ViewGroup
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
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
// APK carries no secret. The server exchanges a correct code for a
// long-lived cookie via a redirect that drops `?key=...` from the URL; a
// wrong code gets a 404 with the URL (and its `key=` param) left as-is.
// That difference - not any particular HTTP status callback, which proved
// unreliable - is what onPageFinished below uses to tell success from
// failure.
private const val PREFS_FILE = "secure_prefs"
private const val PREF_ACCESS_KEY = "access_key"

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private lateinit var prefs: SharedPreferences

    // The code the current load is trying to authenticate with, so
    // onPageFinished knows whether to act (and what to store) - null once
    // there's no pending auth check.
    private var pendingAccessKey: String? = null
    private var mainFrameLoadFailed = false

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

                override fun onReceivedError(
                    view: WebView,
                    request: WebResourceRequest,
                    error: WebResourceError,
                ) {
                    super.onReceivedError(view, request, error)
                    // A DNS/connection-level failure, not a rejected code -
                    // tracked so onPageFinished doesn't misread "couldn't
                    // reach the server" as "wrong code".
                    if (request.isForMainFrame) {
                        mainFrameLoadFailed = true
                    }
                }

                override fun onPageFinished(view: WebView, url: String) {
                    super.onPageFinished(view, url)
                    val accessKey = pendingAccessKey ?: return
                    pendingAccessKey = null

                    val failed = mainFrameLoadFailed
                    mainFrameLoadFailed = false
                    if (failed) {
                        // Network-level failure: leave the stored key alone
                        // and let the WebView's own offline error page show.
                        return
                    }

                    if (url.contains("key=")) {
                        // Still carrying the key param means the server
                        // never redirected it away, i.e. it was rejected.
                        prefs.edit().remove(PREF_ACCESS_KEY).apply()
                        promptForAccessCode("Kód nie je platný. Skúste to znova.")
                    } else {
                        prefs.edit().putString(PREF_ACCESS_KEY, accessKey).apply()
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
            promptForAccessCode(null)
        }
    }

    private fun loadApp(accessKey: String) {
        pendingAccessKey = accessKey
        webView.loadUrl("$BASE_URL?key=$accessKey")
    }

    private fun promptForAccessCode(message: String?) {
        val input = EditText(this).apply {
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
            hint = "Prístupový kód"
        }
        AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert)
            .setTitle("Prístupový kód")
            .setMessage(message ?: "Zadajte prístupový kód pre Oggi Zatvárač.")
            .setView(input)
            .setCancelable(false)
            .setPositiveButton("Pokračovať") { _, _ ->
                val value = input.text.toString().trim()
                if (value.isEmpty()) {
                    promptForAccessCode("Zadajte kód.")
                } else {
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
