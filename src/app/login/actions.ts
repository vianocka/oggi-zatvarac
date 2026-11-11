"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { logAccess } from "@/lib/access-log";
import {
  SUBPAGES_COOKIE,
  SUBPAGES_COOKIE_MAX_AGE,
  safeEqual,
  safeNextPath,
  sessionToken,
} from "@/lib/subpage-auth";

export async function login(formData: FormData) {
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const password = process.env.SUBPAGES_PASSWORD;
  const given = String(formData.get("password") ?? "");

  if (!password || !safeEqual(given, password)) {
    await logAccess("login-fail", "/login");
    // Slows down password guessing.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  }

  (await cookies()).set(SUBPAGES_COOKIE, sessionToken(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SUBPAGES_COOKIE_MAX_AGE,
    path: "/",
  });
  await logAccess("login-ok", "/login");
  redirect(next);
}

export async function logout() {
  (await cookies()).delete(SUBPAGES_COOKIE);
  redirect("/login");
}
