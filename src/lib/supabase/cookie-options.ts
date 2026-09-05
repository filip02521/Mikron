/** Zgodność wsteczna — opcje ciasteczka sesji pochodzą z `@/lib/auth-local/cookies`. */

export {
  sessionCookieOptions as supabaseCookieOptions,
  clearSessionCookieOptions,
  COOKIE_NAME,
  type SessionCookieOptions,
} from "@/lib/auth-local/cookies";
