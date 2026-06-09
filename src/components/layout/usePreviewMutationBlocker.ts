"use client";

import { useAdminPanelPreview } from "@/components/layout/AdminPanelPreviewContext";
import { ADMIN_PANEL_PREVIEW_MUTATION_BLOCKED } from "@/lib/auth/admin-panel-preview-messages";

/** Blokuje mutacje w UI podczas podglądu panelu przez administratora. */
export function usePreviewMutationBlocker(
  onBlocked?: (message: string) => void
): { readOnly: boolean; blockIfReadOnly: () => boolean } {
  const { readOnly } = useAdminPanelPreview();

  function blockIfReadOnly(): boolean {
    if (!readOnly) return false;
    onBlocked?.(ADMIN_PANEL_PREVIEW_MUTATION_BLOCKED);
    return true;
  }

  return { readOnly, blockIfReadOnly };
}
