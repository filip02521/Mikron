import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME } from "@/lib/auth-local/cookies";
import { validateSession } from "@/lib/auth-local/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rawToken = request.cookies.get(COOKIE_NAME)?.value;

  let session: Awaited<ReturnType<typeof validateSession>> = null;
  if (rawToken) {
    try {
      session = await validateSession(rawToken);
    } catch (error) {
      console.error("[api/auth/session]", error);
    }
  }

  return NextResponse.json(
    {
      user: session ? { id: session.userId } : null,
      expiresAt: session ? session.expiresAt.toISOString() : null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
