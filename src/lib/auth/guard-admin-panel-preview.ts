import { cookies } from "next/headers";
import type { SessionUser } from "@/lib/auth";
import { ADMIN_PANEL_PREVIEW_MUTATION_BLOCKED } from "@/lib/auth/admin-panel-preview-messages";
import {
  ADMIN_PANEL_COOKIE,
  resolveAdminPanelContext,
} from "@/lib/auth/admin-panel-context";
import { isAdmin } from "@/lib/auth-roles";

export { ADMIN_PANEL_PREVIEW_MUTATION_BLOCKED };

/** Blokuje mutacje, gdy administrator przegląda inny panel (cookie ≠ admin). */
export async function assertAdminNotInReadOnlyPanelPreview(
  user: Pick<SessionUser, "role"> | null | undefined
): Promise<void> {
  if (!user || !isAdmin(user.role)) return;

  const cookieStore = await cookies();
  const ctx = resolveAdminPanelContext(cookieStore.get(ADMIN_PANEL_COOKIE)?.value);
  if (ctx !== "admin") {
    throw new Error(ADMIN_PANEL_PREVIEW_MUTATION_BLOCKED);
  }
}
