import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessOperations } from "@/lib/auth-roles";
import { fetchOperationsDailyPanelMetrics } from "@/lib/orders/operations-daily-panel-version";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !canAccessOperations(user.role, user.assignedWorkspaces)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const metrics = await fetchOperationsDailyPanelMetrics();
  return NextResponse.json({
    version: metrics.version,
    openBoardQuestions: metrics.openBoardQuestionsCount,
  });
}
