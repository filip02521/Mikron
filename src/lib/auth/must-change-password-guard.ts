export const MUST_CHANGE_PASSWORD_MESSAGE =
  "Ustaw własne hasło przed kontynuacją.";

type MustChangePasswordUser = {
  mustChangePassword: boolean;
};

export function mustChangePasswordBlocked(
  user: MustChangePasswordUser | null
): string | null {
  if (!user?.mustChangePassword) return null;
  return MUST_CHANGE_PASSWORD_MESSAGE;
}

export function assertPasswordChangeCompleted(user: MustChangePasswordUser): void {
  const blocked = mustChangePasswordBlocked(user);
  if (blocked) throw new Error(blocked);
}

export function isPasswordChangeExemptApiPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/auth/password-reset") ||
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/login-form" ||
    pathname === "/api/auth/login-directory" ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/cron")
  );
}
