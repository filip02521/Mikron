import { describe, expect, it } from "vitest";
import {
  classifySupplierBrand,
  findUniqueSupplierIdForCecha,
  findUniqueSupplierIdForGrupa,
  parseZdEstimateLaunchQuery,
  pickUniqueScopeByName,
  resolveZdEstimateSupplierScopeFromSources,
} from "@/lib/orders/zd-estimate-supplier-scope";

describe("classifySupplierBrand", () => {
  it("detects Ivoclar", () => {
    expect(classifySupplierBrand("Ivoclar Vivadent - EXCEL")).toBe("ivoclar");
  });
  it("detects Falcon", () => {
    expect(classifySupplierBrand("Falcon")).toBe("falcon");
  });
  it("other brands", () => {
    expect(classifySupplierBrand("3M ESPE")).toBe("other");
  });
});

describe("resolveZdEstimateSupplierScopeFromSources", () => {
  const groups = [
    { mode: "grupa" as const, id: 17, label: "Falcon" },
    { mode: "grupa" as const, id: 28, label: "Ivoclar Technical" },
    { mode: "grupa" as const, id: 3, label: "Ivoclar Clinical" },
  ];
  const cechy = [{ mode: "cecha" as const, id: 2738, label: "Ivoclar" }];

  it("prefers DB mapping", () => {
    const r = resolveZdEstimateSupplierScopeFromSources({
      supplierName: "Anything",
      db: {
        mode: "grupa",
        grupaId: 17,
        cechaId: null,
        label: "Falcon",
      },
      groups,
      cechy,
    });
    expect(r).toEqual({
      ok: true,
      mode: "grupa",
      grupaId: 17,
      cechaId: null,
      label: "Falcon",
      source: "db",
    });
  });

  it("Ivoclar → cecha, never first group", () => {
    const r = resolveZdEstimateSupplierScopeFromSources({
      supplierName: "Ivoclar Vivadent - EXCEL",
      db: null,
      groups,
      cechy,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.mode).toBe("cecha");
      expect(r.cechaId).toBe(2738);
      expect(r.source).toBe("heuristic");
    }
  });

  it("Falcon → grupa", () => {
    const r = resolveZdEstimateSupplierScopeFromSources({
      supplierName: "Falcon",
      db: null,
      groups,
      cechy,
    });
    expect(r).toMatchObject({
      ok: true,
      mode: "grupa",
      grupaId: 17,
      source: "heuristic",
    });
  });

  it("ambiguous when both group and cecha match token", () => {
    const r = resolveZdEstimateSupplierScopeFromSources({
      supplierName: "UniqueBrand Co",
      db: null,
      groups: [{ mode: "grupa", id: 1, label: "UniqueBrand" }],
      cechy: [{ mode: "cecha", id: 2, label: "UniqueBrand" }],
    });
    expect(r).toEqual({ ok: false, reason: "ambiguous" });
  });

  it("missing when no hits", () => {
    const r = resolveZdEstimateSupplierScopeFromSources({
      supplierName: "Unknown Supplier XYZ",
      db: null,
      groups: [],
      cechy: [],
    });
    expect(r).toEqual({ ok: false, reason: "missing" });
  });
});

describe("pickUniqueScopeByName", () => {
  it("returns single exact match", () => {
    expect(
      pickUniqueScopeByName("Falcon", [
        { mode: "grupa", id: 17, label: "Falcon" },
        { mode: "grupa", id: 99, label: "Other" },
      ])
    ).toEqual({ mode: "grupa", id: 17, label: "Falcon" });
  });
});

describe("findUniqueSupplierIdForGrupa / Cecha", () => {
  const scopes = [
    {
      supplierId: "dongguan",
      mode: "grupa" as const,
      grupaId: 505,
      cechaId: null,
    },
    {
      supplierId: "ivoclar",
      mode: "cecha" as const,
      grupaId: null,
      cechaId: 2738,
    },
  ];

  it("Resione grupa → Dongguan", () => {
    expect(findUniqueSupplierIdForGrupa(scopes, 505)).toBe("dongguan");
  });

  it("brak mapowania → null", () => {
    expect(findUniqueSupplierIdForGrupa(scopes, 17)).toBeNull();
  });

  it("ambiguous gdy dwa dostawcy na tę samą grupę", () => {
    expect(
      findUniqueSupplierIdForGrupa(
        [
          ...scopes,
          {
            supplierId: "other",
            mode: "grupa",
            grupaId: 505,
            cechaId: null,
          },
        ],
        505
      )
    ).toBeNull();
  });

  it("cecha → dostawca", () => {
    expect(findUniqueSupplierIdForCecha(scopes, 2738)).toBe("ivoclar");
  });
});

describe("parseZdEstimateLaunchQuery", () => {
  it("parses daily autorun launch", () => {
    expect(
      parseZdEstimateLaunchQuery({
        from: "daily",
        supplierId: "abc-1",
        autorun: "1",
      })
    ).toEqual({
      fromDaily: true,
      supplierId: "abc-1",
      autorun: true,
      mode: null,
      grupaId: null,
      cechaId: null,
    });
  });

  it("parses mode + ids", () => {
    expect(
      parseZdEstimateLaunchQuery({
        mode: "cecha",
        cechaId: "2738",
        autorun: "true",
      })
    ).toMatchObject({
      autorun: true,
      mode: "cecha",
      cechaId: 2738,
      grupaId: null,
    });
  });
});
