/**
 * Lokalne uwierzytelnianie OnTime — sesje w tabeli `app_sessions`, hasła w `app_users`.
 * Zastępuje `@supabase/ssr` / `@supabase/supabase-js`.
 */

export { hashPassword, verifyPassword } from "./password";

export {
  COOKIE_NAME,
  clearSessionCookieOptions,
  sessionCookieOptions,
  sessionTtlDays,
  sessionTtlMs,
  type SessionCookieOptions,
} from "./cookies";

export {
  createSession,
  destroyAllSessionsForUser,
  destroySession,
  hashToken,
  purgeExpiredSessions,
  validateSession,
  type CreatedSession,
  type SessionContext,
  type SessionRecord,
} from "./session";

export {
  applySessionCookie,
  clearSessionCookie,
  getSessionFromRequest,
  redirectWithSession,
  refreshLocalSession,
  type SessionUser,
} from "./middleware-session";

export {
  confirmUserEmail,
  createAppUser,
  deleteAppUser,
  findUserByEmail,
  findUserById,
  normalizeEmail,
  updatePassword,
  type AppUser,
} from "./users";

export {
  consumeAuthToken,
  createAuthToken,
  revokeAuthTokens,
  type AuthTokenType,
  type CreatedAuthToken,
} from "./tokens";

export {
  deleteInvite,
  getInvite,
  upsertInvite,
  type AppUserInvite,
} from "./invites";
