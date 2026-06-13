import { NextResponse, type NextRequest } from "next/server";
import { isValidEmail } from "@/lib/security/text-limits";
import {
  isValidPasswordResetOtpCode,
  normalizePasswordResetEmail,
  verifyPasswordResetOtp,
} from "@/lib/auth/password-reset-otp";
import { PASSWORD_RESET_SETUP_PATH } from "@/lib/auth/password-reset-constants";
import {
  attachRouteAuthCookies,
  createSupabaseRouteHandlerClient,
} from "@/lib/supabase/route-auth";

type VerifyBody = {
  email?: string;
  code?: string;
};

export async function POST(request: NextRequest) {
  let body: VerifyBody;
  try {
    body = (await request.json()) as VerifyBody;
  } catch {
    return NextResponse.json(
      { ok: false as const, error: "Nieprawidłowe żądanie." },
      { status: 400 }
    );
  }

  const email = normalizePasswordResetEmail(body.email ?? "");
  const code = body.code?.trim() ?? "";

  if (!email || !isValidEmail(email)) {
    return NextResponse.json(
      { ok: false as const, error: "Wybierz konto z listy przed resetem hasła." },
      { status: 400 }
    );
  }

  if (!isValidPasswordResetOtpCode(code)) {
    return NextResponse.json(
      { ok: false as const, error: "Wpisz 6-cyfrowy kod z e-maila." },
      { status: 400 }
    );
  }

  const result = await verifyPasswordResetOtp({ email, code });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false as const, error: result.error },
      { status: 400 }
    );
  }

  const { supabase, cookiesToAttach } = createSupabaseRouteHandlerClient(request);
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: result.tokenHash,
    type: result.otpType,
  });

  if (verifyError) {
    return NextResponse.json(
      {
        ok: false as const,
        error: "Nie udało się rozpocząć resetu hasła. Wyślij kod ponownie.",
      },
      { status: 400 }
    );
  }

  const jsonResponse = NextResponse.json({
    ok: true as const,
    redirectTo: PASSWORD_RESET_SETUP_PATH,
  });

  return attachRouteAuthCookies(jsonResponse, cookiesToAttach);
}
