import { describe, expect, it } from "vitest";
import { suggestSupplierForUnmappedRow } from "./kontrahent-supplier-suggestions";
import type { ZdUnmappedKhRow } from "./zd-unmapped-kh";
import type { AppSupplierRef } from "./match-supplier";

const suppliers: AppSupplierRef[] = [
  { id: "renfert", name: "Renfert", subiektKhId: 100 },
  { id: "ivoclar", name: "Ivoclar", subiektKhId: 688 },
];

describe("suggestSupplierForUnmappedRow", () => {
  it("proponuje dodatkowy alias przy podobnej nazwie", () => {
    const row: ZdUnmappedKhRow = {
      subiektKhId: 999,
      kontrahentLabel: "REN — Renfert Polska sp. z o.o.",
      zdCount: 3,
      sampleDocNumbers: ["ZD/1"],
      lastDocDate: "2026-01-01",
      reason: "no_supplier_kh",
      supplierHint: null,
    };
    const s = suggestSupplierForUnmappedRow(row, suppliers, new Map());
    expect(s?.action).toBe("add_alias");
    expect(s?.supplierId).toBe("renfert");
    expect(s?.score).toBeGreaterThanOrEqual(58);
  });

  it("reindex gdy kh jest już w kartotece", () => {
    const row: ZdUnmappedKhRow = {
      subiektKhId: 688,
      kontrahentLabel: "Ivoclar",
      zdCount: 1,
      sampleDocNumbers: [],
      lastDocDate: null,
      reason: "supplier_exists_reindex",
      supplierHint: "Ivoclar",
    };
    const ownerMap = new Map([[688, "ivoclar"]]);
    const s = suggestSupplierForUnmappedRow(row, suppliers, ownerMap);
    expect(s?.action).toBe("reindex");
    expect(s?.supplierId).toBe("ivoclar");
  });
});
