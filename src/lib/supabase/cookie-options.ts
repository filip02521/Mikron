import type { CookieOptions } from "@supabase/ssr";

/** Ciasteczka sesji — na HTTP (LAN / dev) bez Secure. */
export function supabaseCookieOptions(): CookieOptions {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
  const isHttps = appUrl.startsWith("https://");
  const isDev = process.env.NODE_ENV !== "production";

  return {
    path: "/",
    sameSite: "lax",
    secure: isHttps && !isDev,
    // Supabase SSR odświeża sesję w przeglądarce — httpOnly musi pozostać false.
    httpOnly: false,
  };
}
