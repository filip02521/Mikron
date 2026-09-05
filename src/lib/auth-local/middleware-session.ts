import { NextResponse, type NextRequest } from "next/server";
import { isE2ELab } from "@/lib/e2e-lab/mode";
import {
  COOKIE_NAME,
  clearSessionCookieOptions,
  sessionCookieOptions,
} from "./cookies";
import { validateSession } from "./session";

export interface SessionUser {
  id: string;
}

export function applySessionCookie(
  response: NextResponse,
  rawToken: string,
  expiresAt: Date
): NextResponse {
  const maxAge = Math.max(
    0,
    Math.floor((expiresAt.getTime() - Date.now()) / 1000)
  );
  response.cookies.set(COOKIE_NAME, rawToken, {
    ...sessionCookieOptions(),
    maxAge,
    expires: expiresAt,
  });
  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(COOKIE_NAME, "", clearSessionCookieOptions());
  return response;
}

export async function getSessionFromRequest(
  request: NextRequest
): Promise<{ user: SessionUser | null }> {
  if (isE2ELab()) return { user: null };

  const rawToken = request.cookies.get(COOKIE_NAME)?.value;
  if (!rawToken) return { user: null };

  try {
    const session = await validateSession(rawToken);
    return { user: session ? { id: session.userId } : null };
  } catch (error) {
    console.error("[auth-local] validateSession failed:", error);
    return { user: null };
  }
}

/**
 * Odpowiednik dawnego `refreshSupabaseSession` — sesja jest po stronie serwera,
 * więc „odświeżenie” sprowadza się do walidacji tokenu i skasowania złego ciasteczka.
 */
export async function refreshLocalSession(request: NextRequest): Promise<{
  response: NextResponse;
  user: SessionUser | null;
}> {
  const response = NextResponse.next({ request });

  if (isE2ELab()) {
    return { response, user: null };
  }

  const rawToken = request.cookies.get(COOKIE_NAME)?.value;
  if (!rawToken) {
    return { response, user: null };
  }

  let session: Awaited<ReturnType<typeof validateSession>> = null;
  try {
    session = await validateSession(rawToken);
  } catch (error) {
    console.error("[auth-local] refreshLocalSession failed:", error);
    return { response, user: null };
  }

  if (!session) {
    request.cookies.delete(COOKIE_NAME);
    clearSessionCookie(response);
    return { response, user: null };
  }

  return { response, user: { id: session.userId } };
}

/** Przekierowanie z zachowaniem ciasteczek sesji ustawionych na `sessionResponse`. */
export function redirectWithSession(
  request: NextRequest,
  sessionResponse: NextResponse,
  pathname: string,
  searchParams?: Record<string, string>
): NextResponse {
  // pathname może zawierać query (np. `/moje?dla=…`) — nie wolno wkładać tego w url.pathname.
  const queryIndex = pathname.indexOf("?");
  const pathOnly = queryIndex === -1 ? pathname : pathname.slice(0, queryIndex);
  const fromPath =
    queryIndex === -1
      ? {}
      : Object.fromEntries(new URLSearchParams(pathname.slice(queryIndex + 1)));

  const url = request.nextUrl.clone();
  url.pathname = pathOnly || "/";
  url.search = "";
  for (const [key, value] of Object.entries({ ...fromPath, ...searchParams })) {
    url.searchParams.set(key, value);
  }
  const redirect = NextResponse.redirect(url);
  sessionResponse.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie);
  });
  return redirect;
}
