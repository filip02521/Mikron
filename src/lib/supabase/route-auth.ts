import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, sessionCookieOptions } from "@/lib/auth-local/cookies";
import { createSession, validateSession } from "@/lib/auth-local/session";
import { consumeAuthToken, type AuthTokenType } from "@/lib/auth-local/tokens";
import { createAdminClient } from "@/lib/db/admin";

export type RouteAuthCookie = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

type AuthResult<T> = { data: T; error: { message: string } | null };

function invalidToken(): { message: string } {
  return { message: "Token has expired or is invalid" };
}

function tokenTypeFrom(type: string | null | undefined): AuthTokenType {
  if (type === "invite" || type === "signup") return type;
  return "recovery";
}

function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || null;
}

/**
 * Zgodność wsteczna dla Route Handlerów: sesja czytana jest z ciasteczek żądania,
 * a nowo utworzona trafia do `cookiesToAttach` (podpina ją `attachRouteAuthCookies`).
 */
export function createSupabaseRouteHandlerClient(request: NextRequest) {
  const cookiesToAttach: RouteAuthCookie[] = [];
  const db = createAdminClient();

  const currentSession = async () => {
    const rawToken = request.cookies.get(COOKIE_NAME)?.value;
    if (!rawToken) return null;
    try {
      return await validateSession(rawToken);
    } catch (error) {
      console.error("[route-auth] validateSession failed:", error);
      return null;
    }
  };

  const signIn = async (userId: string) => {
    const { rawToken, expiresAt } = await createSession(userId, {
      userAgent: request.headers.get("user-agent"),
      ip: clientIp(request),
    });
    request.cookies.set(COOKIE_NAME, rawToken);
    cookiesToAttach.push({
      name: COOKIE_NAME,
      value: rawToken,
      options: {
        ...sessionCookieOptions(),
        maxAge: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
        expires: expiresAt,
      },
    });
  };

  const supabase = {
    ...db,
    auth: {
      async getUser(): Promise<AuthResult<{ user: { id: string } | null }>> {
        const session = await currentSession();
        return {
          data: { user: session ? { id: session.userId } : null },
          error: null,
        };
      },

      async getSession(): Promise<
        AuthResult<{ session: { user: { id: string }; expiresAt: string } | null }>
      > {
        const session = await currentSession();
        return {
          data: {
            session: session
              ? {
                  user: { id: session.userId },
                  expiresAt: session.expiresAt.toISOString(),
                }
              : null,
          },
          error: null,
        };
      },

      /** `token_hash` niesie teraz surowy token z `auth_tokens`. */
      async verifyOtp(params: {
        token_hash: string;
        type?: string | null;
      }): Promise<AuthResult<{ user: { id: string } | null }>> {
        const userId = await consumeAuthToken(
          params.token_hash,
          tokenTypeFrom(params.type)
        );
        if (!userId) {
          return { data: { user: null }, error: invalidToken() };
        }
        await signIn(userId);
        return { data: { user: { id: userId } }, error: null };
      },

      async exchangeCodeForSession(
        code: string
      ): Promise<AuthResult<{ user: { id: string } | null }>> {
        const userId = await consumeAuthToken(code, "recovery");
        if (!userId) {
          return { data: { user: null }, error: invalidToken() };
        }
        await signIn(userId);
        return { data: { user: { id: userId } }, error: null };
      },

      async signOut() {
        cookiesToAttach.push({
          name: COOKIE_NAME,
          value: "",
          options: { ...sessionCookieOptions(), maxAge: 0 },
        });
        return { error: null };
      },
    },
  };

  return { supabase, cookiesToAttach };
}

export function attachRouteAuthCookies(
  response: NextResponse,
  cookies: RouteAuthCookie[]
): NextResponse {
  for (const { name, value, options } of cookies) {
    response.cookies.set(name, value, options);
  }
  return response;
}
