import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessOperations, canAccessWarehouse } from "@/lib/auth-roles";
import { fetchOperationsDailyPanelMetrics } from "@/lib/orders/operations-daily-panel-version";
import { departmentsForRole } from "@/lib/operations/notepad-department";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !canAccessOperations(user.role, user.assignedWorkspaces)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const departments = departmentsForRole(user.role, user.assignedWorkspaces);
  const metrics = await fetchOperationsDailyPanelMetrics({
    userId: user.id,
    departments,
  });

  return NextResponse.json({
    version: metrics.version,
    openBoardQuestions: metrics.openBoardQuestionsCount,
    navBadge: metrics.navBadge,
    verificationCount: metrics.verificationCount,
    realizacjaCount: canAccessWarehouse(user.role, user.assignedWorkspaces)
      ? metrics.realizacjaCount
      : 0,
    operationsNotatki: metrics.operationsNotatkiCount,
  });
}
