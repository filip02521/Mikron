/** Trasy bez ciężkiego AppShell (sidebar, badge’e, metryki). */
export const AUTH_LAYOUT_PATHS = [
  "/login",
  "/setup",
  "/ustaw-haslo",
  "/auth/entering",
] as const;

export function isAuthLayoutPath(pathname: string): boolean {
  return (AUTH_LAYOUT_PATHS as readonly string[]).includes(pathname);
}
