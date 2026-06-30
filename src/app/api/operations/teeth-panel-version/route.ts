import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessTeethPanel } from "@/lib/auth-roles";
import { countTeethQueue, fetchTeethQueueVersion } from "@/lib/data/teeth-queue";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !canAccessTeethPanel(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [queueCount, version] = await Promise.all([
    countTeethQueue(),
    fetchTeethQueueVersion(),
  ]);
  return NextResponse.json({
    version: version ?? String(queueCount),
    queueCount,
  });
}
