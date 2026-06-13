import { NextResponse, type NextRequest } from "next/server";
import {
  authRateLimitBucket,
  consumeAuthRateLimit,
} from "@/lib/auth/auth-rate-limit";
import { OTP_MAX_SENDS_WINDOW_MS } from "@/lib/auth/password-reset-constants";
import { sendPasswordResetOtp } from "@/lib/auth/password-reset-otp";

type SendBody = {
  accountId?: string;
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
  let body: SendBody;
  try {
    body = (await request.json()) as SendBody;
  } catch {
    return NextResponse.json(
      { ok: false as const, error: "Nieprawidłowe żądanie." },
      { status: 400 }
    );
  }

  const accountId = body.accountId?.trim() ?? "";
  if (!accountId) {
    return NextResponse.json(
      { ok: false as const, error: "Wybierz konto z listy przed resetem hasła." },
      { status: 400 }
    );
  }

  const ip = clientIp(request);
  if (ip) {
    const ipLimit = await consumeAuthRateLimit({
      bucketKey: authRateLimitBucket("reset-send:ip", ip),
      maxEvents: 10,
      windowMs: OTP_MAX_SENDS_WINDOW_MS,
    });
    if (!ipLimit.ok) {
      return NextResponse.json(
        {
          ok: false as const,
          error: "Zbyt wiele prób resetu z tej sieci. Spróbuj ponownie za chwilę.",
          retryAfterSec: ipLimit.retryAfterSec,
        },
        { status: 429 }
      );
    }
  }

  try {
    const result = await sendPasswordResetOtp({
      accountId,
      requestIp: ip,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false as const,
          error: result.error,
          retryAfterSec: result.retryAfterSec,
        },
        { status: result.retryAfterSec ? 429 : 400 }
      );
    }

    return NextResponse.json({
      ok: true as const,
      maskedEmail: result.maskedEmail,
      resendAvailableAt: result.resendAvailableAt,
    });
  } catch (error) {
    console.error("[password-reset/send]", error);
    return NextResponse.json(
      { ok: false as const, error: "Nie udało się wysłać kodu. Spróbuj ponownie." },
      { status: 500 }
    );
  }
}
