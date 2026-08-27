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

## Access code (currently disabled)

The site *can* be gated behind an access code (see `src/proxy.ts` in the
main project) - it 404s for anyone without a matching `APP_ACCESS_KEY`.
That env var has been removed from Vercel for now (`proxy.ts` no-ops when
it's unset), so the site is public and this app is back to a plain WebView
with no code prompt.

The earlier version of this app (see git history around
"Show an explicit message when the access code is wrong" and nearby
commits) prompted for the code on first launch and stored it in
Keystore-backed `EncryptedSharedPreferences` - but it kept re-prompting
after the app was fully closed and relaunched rather than staying
remembered, which was never root-caused. Re-enabling the gate later means
re-adding `APP_ACCESS_KEY` on Vercel *and* fixing (or reimplementing) that
persistence in the app before it's worth turning back on.
