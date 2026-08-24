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

Edit `APP_URL` / `APP_HOST` at the top of
`app/src/main/java/app/vercel/oggizatvarac/webview/MainActivity.kt`.

## Access key

The site 404s for anyone without the right key (see `src/proxy.ts` in the
main project). `APP_URL` appends `?key=...` on first load, which the server
exchanges for a long-lived cookie - so this app doesn't need to send it
again after that. `APP_ACCESS_KEY` in this file must match the
`APP_ACCESS_KEY` environment variable set on Vercel; rotate both together.
