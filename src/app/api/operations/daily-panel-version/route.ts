import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessOperations, canAccessWarehouse } from "@/lib/auth-roles";
import { fetchOperationsDailyPanelMetrics } from "@/lib/orders/operations-daily-panel-version";
import { departmentsForRole } from "@/lib/operations/notepad-department";
import { countSupplierMailNeedsAction } from "@/lib/supplier-mail/data";
import { syncSupplierMail } from "@/lib/supplier-mail/sync";

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
  // Poczta dostawców (Asystent): admin i zakupy. Synchronizacja w tle — najwyżej co 5 min na skrzynkę,
  // równoległe wywołania czekają na ten sam przebieg; licznik z bazy (bez Gmaila).
  const mailRole = user.role === "admin" || user.role === "zakupy";
  if (mailRole) {
    // ponytail: obietnica w tle w procesie Node (jeden serwer OnTime); przy serverless — cron.
    void syncSupplierMail().catch((e) => console.error("[poczta] synchronizacja", e));
  }
  const supplierMail = mailRole ? await countSupplierMailNeedsAction() : undefined;

  return NextResponse.json({
    version: metrics.version,
    openBoardQuestions: metrics.openBoardQuestionsCount,
    navBadge: metrics.navBadge,
    verificationCount: metrics.verificationCount,
    realizacjaCount: canAccessWarehouse(user.role, user.assignedWorkspaces)
      ? metrics.realizacjaCount
      : 0,
    operationsNotatki: metrics.operationsNotatkiCount,
    supplierMail,
  });
}
