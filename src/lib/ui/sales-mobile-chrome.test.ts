import { describe, expect, it } from "vitest";
import {
  ADMIN_PREVIEW_DOCK_HEIGHT,
  adminPreviewDockShellVarsClass,
} from "@/lib/ui/sales-mobile-chrome";

describe("adminPreviewDockShellVarsClass", () => {
  it("ustawia zmienne z wysokością docka jako literały (Tailwind nie widzi interpolacji)", () => {
    expect(adminPreviewDockShellVarsClass).toContain(`[--admin-preview-dock:${ADMIN_PREVIEW_DOCK_HEIGHT}]`);
    expect(adminPreviewDockShellVarsClass).toContain(
      `[--admin-preview-clearance:${ADMIN_PREVIEW_DOCK_HEIGHT}]`,
    );
  });
});
