import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/auth";
import {
  PROCUREMENT_WORKSPACE_COOKIE,
  resolveProcurementWorkspace,
  type ProcurementWorkspace,
  canSwitchProcurementWorkspace,
} from "@/lib/auth/procurement-workspace";
import type { UserRole } from "@/types/database";
import { isAdmin } from "@/lib/auth-roles";

export async function readProcurementWorkspaceForSession(): Promise<{
  realRole: UserRole | null;
  procurementWorkspace: ProcurementWorkspace | null;
  canSwitchProcurementWorkspace: boolean;
}> {
  const session = await getSessionUser();
  if (!session || isAdmin(session.role)) {
    return {
      realRole: session?.role ?? null,
      procurementWorkspace: null,
      canSwitchProcurementWorkspace: false,
    };
  }

  const cookieStore = await cookies();
  const raw = cookieStore.get(PROCUREMENT_WORKSPACE_COOKIE)?.value;
  const workspace = resolveProcurementWorkspace(session.role, raw);

  return {
    realRole: session.role,
    procurementWorkspace: workspace,
    canSwitchProcurementWorkspace: canSwitchProcurementWorkspace(session.role),
  };
}
