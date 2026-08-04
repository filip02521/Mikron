import { describe, expect, it } from "vitest";
import {
  buildProsbaSupplierVacationNoticeModel,
  collectProsbaSupplierIds,
  collectProsbaVacationHits,
  PROSBA_SUPPLIER_VACATION_COPY,
} from "./prosba-supplier-vacation-copy";

const windowA = { startDate: "2026-08-01", endDate: "2026-08-15" };
const windowB = { startDate: "2026-08-10", endDate: "2026-08-20" };

describe("collectProsbaSupplierIds", () => {
  it("zbiera unię z linii i fallback", () => {
    expect(
      collectProsbaSupplierIds(
        [{ supplierId: "a" }, { supplierId: "b" }, { supplierId: "a" }],
        "c"
      ).sort()
    ).toEqual(["a", "b", "c"]);
  });

  it("pomija puste id", () => {
    expect(
      collectProsbaSupplierIds([{ supplierId: "" }, { supplierId: null }], "x")
    ).toEqual(["x"]);
  });
});

describe("collectProsbaVacationHits", () => {
  it("zwraca puste gdy mapa pusta", () => {
    expect(
      collectProsbaVacationHits([{ supplierId: "a" }], {}, {
        supplierNames: { a: "Alpha" },
      })
    ).toEqual([]);
  });

  it("trafia po linii i fallbacku", () => {
    const hits = collectProsbaVacationHits(
      [{ supplierId: "a" }, { supplierId: "" }],
      { a: windowA, b: windowB },
      {
        fallbackSupplierId: "b",
        supplierNames: { a: "Alpha", b: "Beta" },
      }
    );
    expect(hits.map((h) => h.supplierId).sort()).toEqual(["a", "b"]);
    expect(hits.find((h) => h.supplierId === "a")?.supplierName).toBe("Alpha");
  });

  it("tylko initial gdy linie bez id", () => {
    const hits = collectProsbaVacationHits([], { x: windowA }, {
      fallbackSupplierId: "x",
      supplierNames: { x: "X Corp" },
    });
    expect(hits).toHaveLength(1);
    expect(hits[0]?.supplierName).toBe("X Corp");
  });
});

describe("buildProsbaSupplierVacationNoticeModel", () => {
  it("null gdy brak hitów", () => {
    expect(buildProsbaSupplierVacationNoticeModel([])).toBeNull();
  });

  it("jeden dostawca", () => {
    const model = buildProsbaSupplierVacationNoticeModel([
      { supplierId: "a", supplierName: "Alpha", window: windowA },
    ]);
    expect(model?.title).toBe(PROSBA_SUPPLIER_VACATION_COPY.titleOne);
    expect(model?.description).toContain("Alpha");
    expect(model?.description).toContain("1.08–15.08");
    expect(model?.description).toContain(
      PROSBA_SUPPLIER_VACATION_COPY.canStillSubmit
    );
  });

  it("wielu z tym samym zakresem", () => {
    const model = buildProsbaSupplierVacationNoticeModel([
      { supplierId: "a", supplierName: "Alpha", window: windowA },
      { supplierId: "b", supplierName: "Beta", window: windowA },
    ]);
    expect(model?.title).toBe(PROSBA_SUPPLIER_VACATION_COPY.titleMany);
    expect(model?.description).toContain("Alpha i Beta");
    expect(model?.description).toContain("1.08–15.08");
  });

  it("wielu z różnymi okresami", () => {
    const model = buildProsbaSupplierVacationNoticeModel([
      { supplierId: "a", supplierName: "Alpha", window: windowA },
      { supplierId: "b", supplierName: "Beta", window: windowB },
    ]);
    expect(model?.description).toContain(
      PROSBA_SUPPLIER_VACATION_COPY.differentRanges
    );
  });
});
