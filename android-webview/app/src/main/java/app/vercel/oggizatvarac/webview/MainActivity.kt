package app.vercel.oggizatvarac.webview

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback

private const val APP_HOST = "oggi-zatvarac.vercel.app"

// Exchanged by the server (see src/proxy.ts) for a long-lived cookie on
// first load, so the site stays 404-for-everyone-else. Must match the
// APP_ACCESS_KEY environment variable configured on Vercel.
private const val APP_ACCESS_KEY = "YpDKh_wfI4ftJg9hgh2Q3Po6UcB0BqDL"
private const val APP_URL = "https://$APP_HOST/?key=$APP_ACCESS_KEY"

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

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

        webView.loadUrl(APP_URL)
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
