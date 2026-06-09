import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { translatePasswordLinkError } from "@/lib/auth/password-link-errors";
import { safePasswordSetupNextPath } from "@/lib/auth/password-link-redirect";
import {
  attachRouteAuthCookies,
  createSupabaseRouteHandlerClient,
} from "@/lib/supabase/route-auth";

/** Weryfikacja linku zaproszenia / resetu hasła — ustawia ciasteczka sesji i przekierowuje dalej. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safePasswordSetupNextPath(searchParams.get("next"));
  const destination = new URL(next, request.nextUrl.origin);

  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const { supabase, cookiesToAttach } = createSupabaseRouteHandlerClient(request);

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      destination.searchParams.set("blad", translatePasswordLinkError(error.message));
      return NextResponse.redirect(destination);
    }
    const response = NextResponse.redirect(destination);
    return attachRouteAuthCookies(response, cookiesToAttach);
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (error) {
      destination.searchParams.set("blad", translatePasswordLinkError(error.message));
      return NextResponse.redirect(destination);
    }
    const response = NextResponse.redirect(destination);
    return attachRouteAuthCookies(response, cookiesToAttach);
  }

  destination.searchParams.set(
    "blad",
    "Nieprawidłowy link — poproś administratora o nowy."
  );
  return NextResponse.redirect(destination);
}
