import { cookies } from "next/headers";
import type { SessionUser } from "@/lib/auth";
import { ADMIN_PANEL_PREVIEW_MUTATION_BLOCKED } from "@/lib/auth/admin-panel-preview-messages";
import {
  ADMIN_PANEL_COOKIE,
  resolveAdminPanelContext,
  type AdminPanelContext,
} from "@/lib/auth/admin-panel-context";
import { isAdmin } from "@/lib/auth-roles";

export { ADMIN_PANEL_PREVIEW_MUTATION_BLOCKED };

async function adminPanelContextFromCookie(): Promise<AdminPanelContext> {
  const cookieStore = await cookies();
  return resolveAdminPanelContext(cookieStore.get(ADMIN_PANEL_COOKIE)?.value);
}

/** Blokuje mutacje, gdy administrator przegląda inny panel (cookie ≠ admin). */
export async function assertAdminNotInReadOnlyPanelPreview(
  user: Pick<SessionUser, "role"> | null | undefined
): Promise<void> {
  if (!user || !isAdmin(user.role)) return;

  const ctx = await adminPanelContextFromCookie();
  if (ctx !== "admin") {
    throw new Error(ADMIN_PANEL_PREVIEW_MUTATION_BLOCKED);
  }
}

/**
 * Tablica zakupów — admin może publikować w kontekście Admin lub Zakupy
 * (podgląd zakupów to realna praca na tablicy, nie tryb tylko do odczytu).
 */
export async function assertAdminPanelAllowsProcurementBoardMutations(
  user: Pick<SessionUser, "role"> | null | undefined
): Promise<void> {
  if (!user || !isAdmin(user.role)) return;

  const ctx = await adminPanelContextFromCookie();
  if (ctx === "admin" || ctx === "zakupy") return;
  throw new Error(ADMIN_PANEL_PREVIEW_MUTATION_BLOCKED);
}
