import { describe, expect, it } from "vitest";
import { isZdImportAllSuppliersJobResumable } from "./zd-import-all-suppliers-job";
import { isZdImportSupplierJobResumable } from "./zd-import-supplier-job";

describe("zd import job resume", () => {
  it("autopilot: paused i failed można wznowić", () => {
    expect(
      isZdImportAllSuppliersJobResumable({
        status: "paused",
        dataOd: "2020-01-01",
        supplierIds: ["a"],
        supplierIndex: 48,
        supplierId: "a",
        supplierName: "X",
        indexOffset: 0,
        indexTotalDocs: 10,
        batchDocs: 3,
        processedSuppliers: 48,
        processedDocs: 100,
        processedLines: 0,
        linksUpserted: 0,
        lastDocNumber: null,
        lastUpdatedAt: "",
        lastError: null,
      })
    ).toBe(true);
    expect(
      isZdImportAllSuppliersJobResumable({
        status: "failed",
        dataOd: "2020-01-01",
        supplierIds: ["a"],
        supplierIndex: 0,
        supplierId: "a",
        supplierName: null,
        indexOffset: 0,
        indexTotalDocs: null,
        batchDocs: 3,
        processedSuppliers: 0,
        processedDocs: 0,
        processedLines: 0,
        linksUpserted: 0,
        lastDocNumber: null,
        lastUpdatedAt: "",
        lastError: "offline",
      })
    ).toBe(true);
    expect(isZdImportAllSuppliersJobResumable(null)).toBe(false);
    expect(
      isZdImportAllSuppliersJobResumable({
        status: "done",
        dataOd: "",
        supplierIds: [],
        supplierIndex: 0,
        supplierId: null,
        supplierName: null,
        indexOffset: 0,
        indexTotalDocs: null,
        batchDocs: 3,
        processedSuppliers: 0,
        processedDocs: 0,
        processedLines: 0,
        linksUpserted: 0,
        lastDocNumber: null,
        lastUpdatedAt: "",
        lastError: null,
      })
    ).toBe(false);
  });

  it("import per dostawca: paused można wznowić", () => {
    expect(
      isZdImportSupplierJobResumable({
        status: "paused",
        supplierId: "s1",
        supplierName: "X",
        subiektKhId: 1,
        dataOd: "2020-01-01",
        indexOffset: 5,
        indexTotalDocs: 20,
        batchDocs: 3,
        processedDocs: 5,
        processedLines: 0,
        uniqueProductsSeen: 0,
        linksUpserted: 0,
        lastDocNumber: null,
        lastUpdatedAt: "",
        lastError: null,
      })
    ).toBe(true);
    expect(
      isZdImportSupplierJobResumable({
        status: "idle",
        supplierId: "s1",
        supplierName: "X",
        subiektKhId: 1,
        dataOd: "2020-01-01",
        indexOffset: 0,
        indexTotalDocs: null,
        batchDocs: 3,
        processedDocs: 0,
        processedLines: 0,
        uniqueProductsSeen: 0,
        linksUpserted: 0,
        lastDocNumber: null,
        lastUpdatedAt: "",
        lastError: null,
      })
    ).toBe(false);
  });
});
