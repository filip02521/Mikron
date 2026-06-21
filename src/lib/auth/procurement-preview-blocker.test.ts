import { describe, expect, it } from "vitest";
import { isAdminOperationsPreviewReadOnly } from "@/lib/auth/admin-panel-context";

describe("procurement operations preview (E2E lab parity)", () => {
  it("podgląd zakupów nie blokuje mutacji w UI", () => {
    expect(isAdminOperationsPreviewReadOnly("admin", "zakupy")).toBe(false);
  });

  it("podgląd handlowca blokuje mutacje w UI", () => {
    expect(isAdminOperationsPreviewReadOnly("admin", "sales")).toBe(true);
  });
});
