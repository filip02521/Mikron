import { NextResponse, type NextRequest } from "next/server";
import { isValidEmail } from "@/lib/security/text-limits";
import {
  normalizePasswordResetEmail,
  sendPasswordResetOtp,
} from "@/lib/auth/password-reset-otp";

type SendBody = {
  email?: string;
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

  const email = normalizePasswordResetEmail(body.email ?? "");
  if (!email || !isValidEmail(email)) {
    return NextResponse.json(
      { ok: false as const, error: "Wybierz konto z listy przed resetem hasła." },
      { status: 400 }
    );
  }

  try {
    const result = await sendPasswordResetOtp({
      email,
      requestIp: clientIp(request),
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
