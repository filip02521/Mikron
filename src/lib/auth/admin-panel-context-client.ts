import { parseAdminPanelContext, ADMIN_PANEL_COOKIE } from "@/lib/auth/admin-panel-context";
import type { AdminPanelContext } from "@/lib/auth/admin-panel-context";

/** Odczyt kontekstu panelu admina z cookie (fallback gdy API login nie odpowie). */
export function readAdminPanelContextFromDocument(): AdminPanelContext | null {
  if (typeof document === "undefined") return null;
  const prefix = `${ADMIN_PANEL_COOKIE}=`;
  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  if (!entry) return null;
  return parseAdminPanelContext(decodeURIComponent(entry.slice(prefix.length)));
}
