import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getAppUrl } from "@/lib/env/app-config";
import { saveMikranConnection } from "@/lib/mikran-shop/connection";
import {
  MIKRAN_OAUTH_COOKIE,
  MIKRAN_OAUTH_COOKIE_PATH,
  MikranAuthError,
  canConnectMikran,
  exchangeMikranCode,
  mikranReturnPath,
  readMikranOAuthCookie,
} from "@/lib/mikran-shop/oauth";

export const dynamic = "force-dynamic";

function problem(message: string, status = 400, back = "/") {
  const html = `<!doctype html><meta charset="utf-8"><title>Helpdesk mikran.pl — OnTime</title>
<body style="font:15px system-ui,sans-serif;max-width:560px;margin:48px auto;padding:0 16px;line-height:1.5">
<h1 style="font-size:20px">Nie połączono helpdesku mikran.pl</h1><p>${message.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>
<p><a href="${back}">Wróć do OnTime</a></p></body>`;
  const response = new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
  // Stan jednorazowy — także po błędzie, żeby nie dało się go użyć ponownie.
  response.cookies.delete({ name: MIKRAN_OAUTH_COOKIE, path: MIKRAN_OAUTH_COOKIE_PATH });
  return response;
}

/** Powrót z logowania na mikran.pl: sprawdza osobę (serwisant / admin) i stan, wymienia kod (PKCE) na tokeny, zapisuje zaszyfrowane. */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(`${getAppUrl()}/login`);
  if (!canConnectMikran(user.role)) return problem("Helpdesk mikran.pl łączy serwisant albo administrator OnTime.", 403);
  const back = mikranReturnPath(user.role);

  const params = request.nextUrl.searchParams;
  const cookie = readMikranOAuthCookie(request.cookies.get(MIKRAN_OAUTH_COOKIE)?.value, params.get("state"), user.id);
  if (!cookie.ok) return problem("Sesja łączenia wygasła albo jest nieprawidłowa. Kliknij „Połącz z helpdeskiem” jeszcze raz.", 400, back);
  if (params.get("error")) return problem("Logowanie na mikran.pl zostało przerwane albo odrzucone.", 400, back);
  const code = params.get("code");
  if (!code) return problem("Sklep mikran.pl nie zwrócił kodu autoryzacji.", 400, back);

  try {
    await saveMikranConnection(await exchangeMikranCode(code, cookie.verifier), user.id);
  } catch (e) {
    // Opis tylko z naszych komunikatów (sklep, klucz szyfrowania) — błąd bazy czy sieci nie trafia na stronę.
    return problem(e instanceof MikranAuthError ? e.message : "Nie udało się połączyć z mikran.pl. Spróbuj jeszcze raz za chwilę.", 502, back);
  }

  const response = NextResponse.redirect(`${getAppUrl()}${back}`);
  response.cookies.delete({ name: MIKRAN_OAUTH_COOKIE, path: MIKRAN_OAUTH_COOKIE_PATH });
  return response;
}
