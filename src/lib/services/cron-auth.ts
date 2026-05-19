import { NextResponse } from "next/server";
import { getCronSecret } from "@/lib/env/app-config";

export function authorizeCronRequest(
  authorizationHeader: string | null
): NextResponse | null {
  const secret = getCronSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET nie jest skonfigurowany" },
      { status: 503 }
    );
  }
  if (authorizationHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
