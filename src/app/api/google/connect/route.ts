import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getAppUrl } from "@/lib/env/app-config";
import { buildGmailAuthUrl, getGmailOAuthConfig } from "@/lib/google/gmail";
import {
  GMAIL_OAUTH_COOKIE,
  GMAIL_OAUTH_SHARED_COOKIE,
  canConnectSharedMailbox,
  safeReturnPath,
} from "@/lib/google/gmail-oauth-cookie";

export const dynamic = "force-dynamic";

/** Start „Połącz z Gmailem”: stan CSRF w ciasteczku → zgoda w Google → /api/google/callback. */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(`${getAppUrl()}/login`);
  const cfg = getGmailOAuthConfig();
  if (!cfg) {
    return new NextResponse("Wysyłka z Gmaila nie jest skonfigurowana na serwerze OnTime.", { status: 503 });
  }
  // ?shared=1 — skrzynka wspólna (office@): logowanie w Google na tę skrzynkę, bez podpowiedzi konta osoby.
  const shared = request.nextUrl.searchParams.get("shared") === "1";
  if (shared && !canConnectSharedMailbox(user.role)) {
    return new NextResponse("Skrzynkę wspólną podłącza admin albo zakupy.", { status: 403 });
  }
  const state = randomBytes(24).toString("base64url");
  const returnTo = safeReturnPath(request.nextUrl.searchParams.get("returnTo"));
  const response = NextResponse.redirect(buildGmailAuthUrl(cfg, state, shared ? undefined : user.email || undefined));
  const cookie = {
    httpOnly: true,
    secure: getAppUrl().startsWith("https://"),
    sameSite: "lax" as const,
    path: "/api/google",
    maxAge: 600,
  };
  response.cookies.set(GMAIL_OAUTH_COOKIE, `${state}|${returnTo}`, cookie);
  if (shared) response.cookies.set(GMAIL_OAUTH_SHARED_COOKIE, state, cookie);
  else response.cookies.delete({ name: GMAIL_OAUTH_SHARED_COOKIE, path: "/api/google" });
  return response;
}
