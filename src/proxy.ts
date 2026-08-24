import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Basic access gate: the site is meant to be opened only from the Android
// app, which loads it once with `?key=<APP_ACCESS_KEY>` baked into its
// start URL. A matching key is exchanged for a long-lived, httpOnly cookie
// so the app (and any Server Function calls it makes afterwards) doesn't
// need to keep passing the key. Anyone else - a browser, a crawler, a link
// shared around - gets a plain 404 with no hint the app exists.
//
// This is deliberately "basic": the key lives in the (decompiled-able) APK
// and travels as a URL param on first load, so it deters casual/opportunistic
// access rather than a targeted attacker. It is not a substitute for real
// authentication if the data behind this ever needs to be treated as secret.
const COOKIE_NAME = "oz_access";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
const KEY_PARAM = "key";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // Buffers of different length would throw in timingSafeEqual; bail out
  // early (this alone leaks a length-mismatch bit, which is fine here).
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function proxy(request: NextRequest) {
  const accessKey = process.env.APP_ACCESS_KEY;

  // Gate is opt-in: unset APP_ACCESS_KEY (e.g. local dev) leaves the app
  // open, same as before this was added.
  if (!accessKey) {
    return NextResponse.next();
  }

  const cookieValue = request.cookies.get(COOKIE_NAME)?.value ?? "";
  if (safeEqual(cookieValue, accessKey)) {
    return NextResponse.next();
  }

  const keyParam = request.nextUrl.searchParams.get(KEY_PARAM) ?? "";
  if (safeEqual(keyParam, accessKey)) {
    // Correct key: strip it from the URL (so it doesn't linger anywhere
    // it'd be visible) and remember this device via cookie instead.
    const url = request.nextUrl.clone();
    url.searchParams.delete(KEY_PARAM);
    const response = NextResponse.redirect(url);
    response.cookies.set(COOKIE_NAME, accessKey, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });
    return response;
  }

  return new NextResponse("Not found.", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export const config = {
  matcher: [
    // Exclude Next's internal static/image assets and .well-known (Digital
    // Asset Links for the TWA build must stay publicly fetchable, and it's
    // not sensitive - that's how it's designed to be used).
    "/((?!_next/static|_next/image|\\.well-known).*)",
  ],
};
