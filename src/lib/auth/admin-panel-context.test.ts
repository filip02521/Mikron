import { describe, expect, it } from "vitest";
import { shouldApplyAdminSalesPreviewHeader } from "@/lib/auth/admin-panel-context";

describe("shouldApplyAdminSalesPreviewHeader", () => {
  it("włącza podgląd tylko dla kontekstu sales z ?dla=", () => {
    expect(shouldApplyAdminSalesPreviewHeader("sales", "sp-1")).toBe(true);
    expect(shouldApplyAdminSalesPreviewHeader("sales", "  sp-2  ")).toBe(true);
  });

  it("wyłącza podgląd po powrocie do administracji", () => {
    expect(shouldApplyAdminSalesPreviewHeader("admin", "sp-1")).toBe(false);
  });

  it("nie stosuje ?dla= w innych kontekstach podglądu", () => {
    expect(shouldApplyAdminSalesPreviewHeader("zakupy", "sp-1")).toBe(false);
    expect(shouldApplyAdminSalesPreviewHeader("sales_manager", "sp-1")).toBe(false);
  });

  it("ignoruje pusty identyfikator", () => {
    expect(shouldApplyAdminSalesPreviewHeader("sales", null)).toBe(false);
    expect(shouldApplyAdminSalesPreviewHeader("sales", "   ")).toBe(false);
  });
});
