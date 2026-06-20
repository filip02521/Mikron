import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Publiczny ping — bez diagnostyki DB (load balancer / uptime). */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
