import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSubiektConfigSummary } from "@/lib/subiekt/config";
import { testSubiektConnection } from "@/lib/subiekt/client";

export const dynamic = "force-dynamic";

/** Test połączenia z API Subiekta (tylko admin, sesja). */
export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Brak uprawnień" }, { status: 403 });
  }

  const summary = getSubiektConfigSummary();
  const result = await testSubiektConnection();

  return NextResponse.json({
    summary,
    result,
  });
}
