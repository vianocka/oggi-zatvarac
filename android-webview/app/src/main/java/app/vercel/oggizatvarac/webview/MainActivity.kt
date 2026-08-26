package app.vercel.oggizatvarac.webview

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.Intent
import android.content.SharedPreferences
import android.os.Bundle
import android.os.Handler
import android.os.Looper
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
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

private const val APP_HOST = "oggi-zatvarac.vercel.app"
private const val BASE_URL = "https://$APP_HOST/"

// The access code (see src/proxy.ts / APP_ACCESS_KEY on Vercel) is entered
// once by whoever sets up the device and kept only in Keystore-backed
// EncryptedSharedPreferences - never in source, so a shared or decompiled
// APK carries no secret. The server exchanges it for a long-lived cookie on
// first load, so this prompt only reappears if that access is ever revoked
// (e.g. the key gets rotated).
private const val PREFS_FILE = "secure_prefs"
private const val PREF_ACCESS_KEY = "access_key"

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private lateinit var prefs: SharedPreferences
    private val mainHandler = Handler(Looper.getMainLooper())

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
                    // Safety net for a code that gets revoked *mid-session*
                    // (cookie stops working after a rotation). The initial
                    // launch / code-entry path below never relies on this -
                    // it checks explicitly first, so a wrong code always
                    // gets an immediate, visible message instead of quietly
                    // rendering the server's blank 404 page.
                    if (request.isForMainFrame && errorResponse.statusCode == 404) {
                        runOnUiThread {
                            prefs.edit().remove(PREF_ACCESS_KEY).apply()
                            promptForAccessCode("Prístup vypršal. Zadajte kód znova.")
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
            verifyThenLoad(storedKey)
        } else {
            promptForAccessCode(null)
        }
    }

    // Checks the code against the server directly (off the WebView
    // entirely) before ever loading it, so a wrong code always produces an
    // explicit dialog. A confirmed-wrong code (404) clears what was stored
    // and re-prompts; anything else (network hiccup, timeout, ...) is
    // treated as "can't tell" and falls through to loading the WebView
    // anyway, which has its own reasonable offline error page for that.
    private fun verifyThenLoad(accessKey: String) {
        Thread {
            val confirmedInvalid = try {
                val connection =
                    URL("$BASE_URL?key=$accessKey").openConnection() as HttpURLConnection
                connection.instanceFollowRedirects = false
                connection.connectTimeout = 10_000
                connection.readTimeout = 10_000
                val code = connection.responseCode
                connection.disconnect()
                code == 404
            } catch (e: IOException) {
                false
            }

            mainHandler.post {
                if (confirmedInvalid) {
                    prefs.edit().remove(PREF_ACCESS_KEY).apply()
                    promptForAccessCode("Kód nie je platný. Skúste to znova.")
                } else {
                    prefs.edit().putString(PREF_ACCESS_KEY, accessKey).apply()
                    webView.loadUrl("$BASE_URL?key=$accessKey")
                }
            }
        }.start()
    }

    private fun promptForAccessCode(message: String?) {
        val input = EditText(this).apply {
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
            hint = "Prístupový kód"
        }
        AlertDialog.Builder(this)
            .setTitle("Prístupový kód")
            .setMessage(message ?: "Zadajte prístupový kód pre Oggi Zatvárač.")
            .setView(input)
            .setCancelable(false)
            .setPositiveButton("Pokračovať") { _, _ ->
                val value = input.text.toString().trim()
                if (value.isEmpty()) {
                    promptForAccessCode("Zadajte kód.")
                } else {
                    verifyThenLoad(value)
                }
            }
            .show()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
