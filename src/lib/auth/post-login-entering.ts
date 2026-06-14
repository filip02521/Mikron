import { AUTH_LAYOUT_PATHS } from "@/lib/auth/auth-layout-paths";

const BLOCKED_POST_LOGIN_TARGETS = new Set<string>([
  ...AUTH_LAYOUT_PATHS,
  "/auth/confirm",
]);

function pathnameOnly(path: string): string {
  const queryIndex = path.indexOf("?");
  return queryIndex === -1 ? path : path.slice(0, queryIndex);
}

function isBlockedPostLoginTarget(path: string): boolean {
  return BLOCKED_POST_LOGIN_TARGETS.has(pathnameOnly(path));
}

/** Bezpieczny wewnętrzny redirect po logowaniu (bez open redirect). */
export function resolvePostLoginTarget(next: string | null | undefined): string {
  const trimmed = next?.trim() ?? "";
  if (
    !trimmed ||
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("\\")
  ) {
    return "/";
  }
  if (trimmed.startsWith("/auth/entering")) {
    try {
      const query = trimmed.includes("?") ? trimmed.slice(trimmed.indexOf("?")) : "";
      const nested = new URLSearchParams(query).get("next");
      if (nested) {
        return resolvePostLoginTarget(decodeURIComponent(nested));
      }
    } catch {
      return "/";
    }
    return "/";
  }
  if (isBlockedPostLoginTarget(trimmed)) {
    return "/";
  }
  return trimmed;
}

/** Po udanym logowaniu — krótki ekran wejścia zamiast białego ekranu podczas ładowania shell. */
export function postLoginEnteringUrl(target: string): string {
  const trimmed = target?.trim() ?? "";
  if (pathnameOnly(trimmed) === "/ustaw-haslo") {
    return trimmed.startsWith("/") ? trimmed : "/ustaw-haslo";
  }
  const safeTarget = resolvePostLoginTarget(target);
  return `/auth/entering?next=${encodeURIComponent(safeTarget)}`;
}

/** Rozbija wewnętrzną ścieżkę na pathname i parametry (np. dla proxy redirect). */
export function splitInternalRedirectPath(path: string): {
  pathname: string;
  searchParams: Record<string, string>;
} {
  const trimmed = path.trim();
  const queryIndex = trimmed.indexOf("?");
  if (queryIndex === -1) {
    return { pathname: trimmed, searchParams: {} };
  }
  const pathname = trimmed.slice(0, queryIndex);
  const searchParams = Object.fromEntries(
    new URLSearchParams(trimmed.slice(queryIndex))
  );
  return { pathname, searchParams };
}
