import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME } from "@/lib/auth-local/cookies";
import { clearSessionCookie } from "@/lib/auth-local/middleware-session";
import { destroySession } from "@/lib/auth-local/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const rawToken = request.cookies.get(COOKIE_NAME)?.value;

  if (rawToken) {
    try {
      await destroySession(rawToken);
    } catch (error) {
      // Ciasteczko i tak kasujemy — użytkownik nie może zostać zalogowany przez błąd bazy.
      console.error("[api/auth/logout]", error);
    }
  }

  const response = NextResponse.json(
    { ok: true as const },
    { headers: { "Cache-Control": "no-store" } }
  );
  return clearSessionCookie(response);
}
