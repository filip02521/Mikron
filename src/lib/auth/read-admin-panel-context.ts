import { cookies } from "next/headers";
import type { AdminPanelContext } from "@/lib/auth/admin-panel-context";
import {
  ADMIN_PANEL_COOKIE,
  resolveAdminPanelContext,
} from "@/lib/auth/admin-panel-context";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/auth-roles";

export async function readAdminPanelContextForSession(): Promise<{
  realRole: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>["role"] | null;
  panelContext: AdminPanelContext | null;
}> {
  const session = await getSessionUser();
  if (!session || !isAdmin(session.role)) {
    return { realRole: session?.role ?? null, panelContext: null };
  }
  const cookieStore = await cookies();
  const raw = cookieStore.get(ADMIN_PANEL_COOKIE)?.value;
  return {
    realRole: session.role,
    panelContext: resolveAdminPanelContext(raw),
  };
}
