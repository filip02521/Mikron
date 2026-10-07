import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getAppUrl } from "@/lib/env/app-config";
import { exchangeGmailCode, getGmailOAuthConfig, revokeGmailToken } from "@/lib/google/gmail";
import { saveGmailConnection, saveSharedMailbox } from "@/lib/google/gmail-connections";
import {
  GMAIL_OAUTH_COOKIE,
  GMAIL_OAUTH_SHARED_COOKIE,
  canConnectSharedMailbox,
  readGmailOAuthCookie,
} from "@/lib/google/gmail-oauth-cookie";

export const dynamic = "force-dynamic";

function problem(message: string, status = 400) {
  const html = `<!doctype html><meta charset="utf-8"><title>Gmail — OnTime</title>
<body style="font:15px system-ui,sans-serif;max-width:560px;margin:48px auto;padding:0 16px;line-height:1.5">
<h1 style="font-size:20px">Nie połączono Gmaila</h1><p>${message.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>
<p><a href="/">Wróć do OnTime</a></p></body>`;
  const response = new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
  // Stan jednorazowy — także po błędzie, żeby nie dało się go użyć ponownie.
  response.cookies.delete({ name: GMAIL_OAUTH_COOKIE, path: "/api/google" });
  response.cookies.delete({ name: GMAIL_OAUTH_SHARED_COOKIE, path: "/api/google" });
  return response;
}

/** Ta sama domena co konto w OnTime — skrzynka wspólna firmy, nie prywatna. */
function sameDomain(a: string, b: string): boolean {
  const domain = (e: string) => e.trim().toLowerCase().split("@")[1] ?? "";
  return Boolean(domain(a)) && domain(a) === domain(b);
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

  const shared = request.cookies.get(GMAIL_OAUTH_SHARED_COOKIE)?.value === params.get("state");
  try {
    const granted = await exchangeGmailCode(cfg, code);
    if (shared) {
      if (!canConnectSharedMailbox(user.role)) {
        await revokeGmailToken(granted.refreshToken);
        return problem("Skrzynkę wspólną podłącza admin albo zakupy.", 403);
      }
      if (!sameDomain(granted.email, user.email) || granted.email === user.email.trim().toLowerCase()) {
        await revokeGmailToken(granted.refreshToken);
        return problem(
          `Skrzynka wspólna musi być firmowa i inna niż Twoja (zalogowano w Google jako ${granted.email}).`
        );
      }
      await saveSharedMailbox({ connectedBy: user.id, ...granted });
    } else if (granted.email !== user.email.trim().toLowerCase()) {
      await revokeGmailToken(granted.refreshToken);
      return problem(
        `Zalogowano w Google jako ${granted.email}, a w OnTime jako ${user.email}. Połącz Gmaila tego samego konta.`
      );
    } else {
      await saveGmailConnection({ userId: user.id, ...granted });
    }
  } catch (e) {
    return problem(e instanceof Error ? e.message : "Nie udało się połączyć z Google.", 502);
  }

  const response = NextResponse.redirect(`${getAppUrl()}${cookie.returnTo}`);
  response.cookies.delete({ name: GMAIL_OAUTH_COOKIE, path: "/api/google" });
  response.cookies.delete({ name: GMAIL_OAUTH_SHARED_COOKIE, path: "/api/google" });
  return response;
}
