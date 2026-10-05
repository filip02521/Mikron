import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getAppUrl } from "@/lib/env/app-config";
import { exchangeGmailCode, getGmailOAuthConfig, revokeGmailToken } from "@/lib/google/gmail";
import { saveGmailConnection } from "@/lib/google/gmail-connections";
import { GMAIL_OAUTH_COOKIE, readGmailOAuthCookie } from "@/lib/google/gmail-oauth-cookie";

export const dynamic = "force-dynamic";

function problem(message: string, status = 400) {
  const html = `<!doctype html><meta charset="utf-8"><title>Gmail — OnTime</title>
<body style="font:15px system-ui,sans-serif;max-width:560px;margin:48px auto;padding:0 16px;line-height:1.5">
<h1 style="font-size:20px">Nie połączono Gmaila</h1><p>${message.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>
<p><a href="/">Wróć do OnTime</a></p></body>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

/** Powrót z Google: sprawdza stan, konto (= konto w OnTime), zapisuje zaszyfrowany token. */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(`${getAppUrl()}/login`);
  const cfg = getGmailOAuthConfig();
  if (!cfg) return problem("Wysyłka z Gmaila nie jest skonfigurowana na serwerze OnTime.", 503);

  const params = request.nextUrl.searchParams;
  const cookie = readGmailOAuthCookie(request.cookies.get(GMAIL_OAUTH_COOKIE)?.value, params.get("state"));
  if (!cookie.ok) return problem("Sesja łączenia wygasła albo jest nieprawidłowa. Spróbuj jeszcze raz.");
  if (params.get("error")) return problem("Nie udzielono zgody w Google.");
  const code = params.get("code");
  if (!code) return problem("Google nie zwrócił kodu autoryzacji.");

  try {
    const granted = await exchangeGmailCode(cfg, code);
    if (granted.email !== user.email.trim().toLowerCase()) {
      await revokeGmailToken(granted.refreshToken);
      return problem(
        `Zalogowano w Google jako ${granted.email}, a w OnTime jako ${user.email}. Połącz Gmaila tego samego konta.`
      );
    }
    await saveGmailConnection({ userId: user.id, ...granted });
  } catch (e) {
    return problem(e instanceof Error ? e.message : "Nie udało się połączyć z Google.", 502);
  }

  const response = NextResponse.redirect(`${getAppUrl()}${cookie.returnTo}`);
  response.cookies.delete({ name: GMAIL_OAUTH_COOKIE, path: "/api/google" });
  return response;
}
