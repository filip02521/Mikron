import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessTeethPanel } from "@/lib/auth-roles";
import { countTeethQueue, countTeethVerificationQueue, fetchTeethQueueVersion } from "@/lib/data/teeth-queue";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !canAccessTeethPanel(user.role, user.assignedWorkspaces)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [queueCount, verificationCount, version] = await Promise.all([
    countTeethQueue(),
    countTeethVerificationQueue(),
    fetchTeethQueueVersion(),
  ]);
  return NextResponse.json({
    version: version ?? String(queueCount),
    queueCount,
    verificationCount,
  });
}
