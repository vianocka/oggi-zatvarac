# Oggi Zatvárač - Android WebView wrapper

A minimal native Android app: a single `WebView` loading
`https://oggi-zatvarac.vercel.app/`, no browser chrome, no Chrome-specific
disclosures or prompts (that's a Trusted Web Activity concern, not relevant
here).

## Run it

1. Open this `android-webview/` folder in Android Studio (File → Open).
2. Let it sync Gradle (first run will download the Gradle distribution and
   Android dependencies - can take a few minutes).
3. Start an emulator from Device Manager if one isn't already running.
4. Click the green ▶ Run button, targeting your emulator/device.

No signing/keystore setup needed for this - Android Studio signs debug
builds automatically. If you later want a release build for sideloading
outside Android Studio, use **Build → Generate Signed Bundle / APK**.

## Changing the URL

Edit `APP_HOST` / `BASE_URL` at the top of
`app/src/main/java/app/vercel/oggizatvarac/webview/MainActivity.kt`.

## Access code

The site 404s for anyone without the right key (see `src/proxy.ts` in the
main project). This app does **not** ship the key in source: on first
launch it shows a dialog asking for the access code, which must match the
`APP_ACCESS_KEY` environment variable set on Vercel. Whoever sets up a
device types it in once; it's then stored in Keystore-backed
`EncryptedSharedPreferences` on that device and sent as `?key=...`, which
the server exchanges for a long-lived cookie so it isn't resent on every
load. A leaked or decompiled APK carries no secret.

To rotate the key: change `APP_ACCESS_KEY` on Vercel and tell whoever runs
the app the new code - no rebuild/reinstall needed. The app tells success
from failure by what the *same* request the WebView makes actually does: a
correct code gets redirected to a `key`-less URL (and the app stores it);
a wrong one gets a 404 with the `key=...` URL left untouched (and the app
clears what was stored, then re-prompts with "Kód nie je platný. Skúste to
znova."). A connection-level failure (no signal, DNS hiccup, ...) is
tracked separately so it's never mistaken for a rejected code - the stored
code is left alone and the WebView's own offline error page shows instead.
