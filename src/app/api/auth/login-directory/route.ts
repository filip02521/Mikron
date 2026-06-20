import { NextRequest, NextResponse } from "next/server";
import {
  fetchLoginDirectoryAccountById,
  isLoginDirectoryAccountId,
  isLoginDirectoryQueryValid,
  searchLoginDirectoryAccounts,
} from "@/lib/auth/login-directory";
import { toPublicLoginDirectoryAccounts } from "@/lib/auth/login-directory-public";
import { consumeAuthRateLimit } from "@/lib/auth/auth-rate-limit";

export const dynamic = "force-dynamic";

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function GET(request: NextRequest) {
  const ip = clientIp(request);
  const rate = await consumeAuthRateLimit({
    bucketKey: `login-directory:${ip}`,
    maxEvents: 30,
    windowMs: 15 * 60 * 1000,
  });
  if (!rate.ok) {
    return NextResponse.json(
      {
        error: rate.unavailable
          ? "Wyszukiwanie kont jest chwilowo niedostępne."
          : `Zbyt wiele wyszukiwań. Spróbuj za ${rate.retryAfterSec} s.`,
      },
      { status: 429 }
    );
  }

  const id = request.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (id) {
    if (!isLoginDirectoryAccountId(id)) {
      return NextResponse.json({ account: null });
    }
    const account = await fetchLoginDirectoryAccountById(id);
    if (!account) {
      return NextResponse.json({ account: null });
    }
    const [publicAccount] = toPublicLoginDirectoryAccounts([account]);
    return NextResponse.json({ account: publicAccount ?? null });
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!isLoginDirectoryQueryValid(query)) {
    return NextResponse.json({
      accounts: [],
      minQueryLength: 3,
    });
  }

  const accounts = toPublicLoginDirectoryAccounts(await searchLoginDirectoryAccounts(query));
  return NextResponse.json({ accounts });
}
