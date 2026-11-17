import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getAppUrl } from "@/lib/env/app-config";
import {
  MIKRAN_OAUTH_COOKIE,
  MIKRAN_OAUTH_COOKIE_PATH,
  canConnectMikran,
  mikranAuthorizeUrl,
  mikranOAuthCookieValue,
  pkcePair,
} from "@/lib/mikran-shop/oauth";

export const dynamic = "force-dynamic";

/** Start „Połącz z helpdeskiem” (serwisant albo admin): stan i weryfikator PKCE w ciasteczku → logowanie na mikran.pl. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(`${getAppUrl()}/login`);
  if (!canConnectMikran(user.role)) return new NextResponse("Helpdesk mikran.pl łączy serwisant albo administrator.", { status: 403 });

  const state = randomBytes(24).toString("base64url");
  const { verifier, challenge } = pkcePair();
  const response = NextResponse.redirect(mikranAuthorizeUrl({ state, challenge }));
  response.cookies.set(MIKRAN_OAUTH_COOKIE, mikranOAuthCookieValue(state, user.id, verifier), {
    httpOnly: true,
    secure: getAppUrl().startsWith("https://"),
    sameSite: "lax",
    path: MIKRAN_OAUTH_COOKIE_PATH,
    maxAge: 600,
  });
  return response;
}
