import { describe, expect, it } from "vitest";
import {
  isAdminOperationsPreviewReadOnly,
  isAdminReadOnlyPanelPreview,
  shouldApplyAdminSalesPreviewHeader,
} from "@/lib/auth/admin-panel-context";

describe("isAdminOperationsPreviewReadOnly", () => {
  it("zezwalają na mutacje w podglądzie zakupów", () => {
    expect(isAdminOperationsPreviewReadOnly("admin", "zakupy")).toBe(false);
  });

  it("blokują mutacje w podglądzie magazynu i handlowca", () => {
    expect(isAdminOperationsPreviewReadOnly("admin", "magazyn")).toBe(true);
    expect(isAdminOperationsPreviewReadOnly("admin", "sales")).toBe(true);
    expect(isAdminOperationsPreviewReadOnly("admin", "sales_manager")).toBe(true);
  });

  it("nie dotyczy roli zakupy ani natywnego panelu admina", () => {
    expect(isAdminOperationsPreviewReadOnly("zakupy", null)).toBe(false);
    expect(isAdminOperationsPreviewReadOnly("admin", null)).toBe(false);
    expect(isAdminOperationsPreviewReadOnly("admin", "admin")).toBe(false);
  });
});

describe("isAdminReadOnlyPanelPreview", () => {
  it("traktuje każdy podgląd panelu admina jako read-only dla stron handlowca", () => {
    expect(isAdminReadOnlyPanelPreview("admin", "zakupy")).toBe(true);
    expect(isAdminReadOnlyPanelPreview("admin", "sales")).toBe(true);
  });
});

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
