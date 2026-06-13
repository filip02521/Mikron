import { NextResponse, type NextRequest } from "next/server";
import {
  authRateLimitBucket,
  authRateLimitHttpResponse,
  consumeAuthRateLimit,
} from "@/lib/auth/auth-rate-limit";
import { isValidPasswordResetOtpCode, verifyPasswordResetOtp } from "@/lib/auth/password-reset-otp";
import {
  OTP_MAX_SENDS_WINDOW_MS,
  PASSWORD_RESET_SETUP_PATH,
} from "@/lib/auth/password-reset-constants";
import {
  attachRouteAuthCookies,
  createSupabaseRouteHandlerClient,
} from "@/lib/supabase/route-auth";

type VerifyBody = {
  accountId?: string;
  code?: string;
};

function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || null;
}

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

  const accountId = body.accountId?.trim() ?? "";
  const code = body.code?.trim() ?? "";

  if (!accountId) {
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

  const ip = clientIp(request);
  if (ip) {
    const ipLimit = await consumeAuthRateLimit({
      bucketKey: authRateLimitBucket("reset-verify:ip", ip),
      maxEvents: 30,
      windowMs: OTP_MAX_SENDS_WINDOW_MS,
    });
    if (!ipLimit.ok) {
      const limited = authRateLimitHttpResponse(
        ipLimit,
        "Zbyt wiele prób weryfikacji. Spróbuj ponownie za chwilę."
      );
      return NextResponse.json(
        { ok: false as const, error: limited.error },
        { status: limited.status }
      );
    }
  }

  const accountLimit = await consumeAuthRateLimit({
    bucketKey: authRateLimitBucket("reset-verify:account", accountId),
    maxEvents: 10,
    windowMs: OTP_MAX_SENDS_WINDOW_MS,
  });
  if (!accountLimit.ok) {
    const limited = authRateLimitHttpResponse(
      accountLimit,
      "Zbyt wiele prób weryfikacji. Wyślij nowy kod."
    );
    return NextResponse.json(
      { ok: false as const, error: limited.error },
      { status: limited.status }
    );
  }

  try {
    const result = await verifyPasswordResetOtp({ accountId, code });
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
  } catch (error) {
    console.error("[password-reset/verify]", error);
    return NextResponse.json(
      { ok: false as const, error: "Nie udało się zweryfikować kodu. Spróbuj ponownie." },
      { status: 500 }
    );
  }
}
