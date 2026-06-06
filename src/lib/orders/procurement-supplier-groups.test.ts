import { describe, expect, it } from "vitest";
import type { SummaryForSomeoneEnriched } from "@/lib/orders/summary-workspace";
import {
  buildProcurementSupplierBlocks,
  collectProcurementSupplierBlockOrderIds,
  filterNavigableProcurementGroups,
  flattenProcurementSupplierBlocks,
  formatProcurementSupplierBlockSummary,
  procurementSupplierBlockConfirmCopy,
  procurementSupplierBlockScopeKey,
  procurementUnseenGroupsLabel,
  showProcurementSupplierBlockHeader,
} from "./procurement-supplier-groups";

function group(
  partial: Partial<SummaryForSomeoneEnriched> &
    Pick<SummaryForSomeoneEnriched, "supplierId" | "supplierName" | "person" | "salesPersonId">
): SummaryForSomeoneEnriched {
  return {
    kind: "forSomeone",
    location: "POLSKA",
    displayText: "",
    hoverNote: "",
    lines: [
      {
        id: "l1",
        products: "X",
        symbol: "",
        quantity: "1",
        mikranCode: "",
        fromSubiekt: false,
        submittedAt: "2026-05-28T10:00:00",
      },
    ],
    orderIds: ["o1"],
    shift: "[DLA KOGOŚ]",
    status: "Nowe",
    nextDate: new Date(),
    submittedAt: "2026-05-28T10:00:00",
    submittedAtLatest: "2026-05-28T10:00:00",
    hasUnseen: false,
    unseenCount: 0,
    flaggedName: partial.supplierName,
    ...partial,
  };
}

describe("buildProcurementSupplierBlocks", () => {
  it("scala grupy tego samego dostawcy obok siebie", () => {
    const dtA = group({
      supplierId: "dt",
      supplierName: "DT Shop",
      person: "Kasia",
      salesPersonId: "sp1",
      submittedAt: "2026-05-28T12:00:00",
    });
    const other = group({
      supplierId: "pol",
      supplierName: "Polkard",
      person: "Ola",
      salesPersonId: "sp2",
      submittedAt: "2026-05-28T11:00:00",
    });
    const dtB = group({
      supplierId: "dt",
      supplierName: "DT Shop",
      person: "Kordian",
      salesPersonId: "sp3",
      submittedAt: "2026-05-28T13:00:00",
    });

    const blocks = buildProcurementSupplierBlocks([dtA, other, dtB]);
    expect(blocks.map((b) => b.supplierName)).toEqual(["Polkard", "DT Shop"]);
    expect(blocks[1]!.requestGroups.map((g) => g.person)).toEqual(["Kasia", "Kordian"]);
  });

  it("stawia blok z nieprzeczytaną prośbą wyżej", () => {
    const seen = group({
      supplierId: "a",
      supplierName: "Alpha",
      person: "A",
      salesPersonId: "1",
      hasUnseen: false,
    });
    const unseen = group({
      supplierId: "b",
      supplierName: "Beta",
      person: "B",
      salesPersonId: "2",
      hasUnseen: true,
      submittedAt: "2026-05-29T10:00:00",
    });

    const blocks = buildProcurementSupplierBlocks([seen, unseen]);
    expect(blocks[0]!.supplierName).toBe("Beta");
  });
});

describe("formatProcurementSupplierBlockSummary", () => {
  it("łączy osoby i liczbę produktów", () => {
    const block = buildProcurementSupplierBlocks([
      group({ supplierId: "dt", supplierName: "DT Shop", person: "Kasia", salesPersonId: "1" }),
      group({ supplierId: "dt", supplierName: "DT Shop", person: "Kordian", salesPersonId: "2" }),
    ])[0]!;
    expect(formatProcurementSupplierBlockSummary(block)).toContain("Kasia");
    expect(formatProcurementSupplierBlockSummary(block)).toContain("Kordian");
    expect(formatProcurementSupplierBlockSummary(block)).toContain("2 produkty");
  });
});

describe("showProcurementSupplierBlockHeader", () => {
  it("pokazuje nagłówek przy 2+ grupach u dostawcy", () => {
    const multi = buildProcurementSupplierBlocks([
      group({ supplierId: "dt", supplierName: "DT", person: "A", salesPersonId: "1" }),
      group({ supplierId: "dt", supplierName: "DT", person: "B", salesPersonId: "2" }),
    ])[0]!;
    const single = buildProcurementSupplierBlocks([
      group({ supplierId: "x", supplierName: "X", person: "A", salesPersonId: "1" }),
    ])[0]!;
    expect(showProcurementSupplierBlockHeader(multi)).toBe(true);
    expect(showProcurementSupplierBlockHeader(single)).toBe(false);
  });
});

describe("flattenProcurementSupplierBlocks", () => {
  it("zachowuje kolejność po zgrupowaniu", () => {
    const blocks = buildProcurementSupplierBlocks([
      group({ supplierId: "b", supplierName: "B", person: "1", salesPersonId: "1" }),
      group({ supplierId: "a", supplierName: "A", person: "2", salesPersonId: "2" }),
    ]);
    const flat = flattenProcurementSupplierBlocks(blocks);
    expect(flat.map((g) => g.supplierName)).toEqual(["A", "B"]);
  });
});

describe("filterNavigableProcurementGroups", () => {
  it("pomija grupy w zwiniętym bloku dostawcy", () => {
    const blocks = buildProcurementSupplierBlocks([
      group({ supplierId: "dt", supplierName: "DT", person: "A", salesPersonId: "1" }),
      group({ supplierId: "dt", supplierName: "DT", person: "B", salesPersonId: "2" }),
      group({ supplierId: "x", supplierName: "X", person: "C", salesPersonId: "3" }),
    ]);
    const collapsed = new Set(["dt"]);
    const visible = filterNavigableProcurementGroups(blocks, collapsed);
    expect(visible.map((g) => g.person)).toEqual(["C"]);
  });

  it("nie ukrywa pojedynczej grupy u dostawcy mimo Set collapse", () => {
    const blocks = buildProcurementSupplierBlocks([
      group({ supplierId: "solo", supplierName: "Solo", person: "A", salesPersonId: "1" }),
    ]);
    const visible = filterNavigableProcurementGroups(blocks, new Set(["solo"]));
    expect(visible).toHaveLength(1);
  });
});

describe("procurementUnseenGroupsLabel", () => {
  it("odmienia liczbę nowych grup", () => {
    expect(procurementUnseenGroupsLabel(1)).toBe("nowa");
    expect(procurementUnseenGroupsLabel(3)).toBe("nowe");
    expect(procurementUnseenGroupsLabel(5)).toBe("nowych");
  });
});

describe("zbiorcze akcje bloku", () => {
  it("zbiera orderIds ze wszystkich grup", () => {
    const block = buildProcurementSupplierBlocks([
      group({
        supplierId: "dt",
        supplierName: "DT",
        person: "A",
        salesPersonId: "1",
        orderIds: ["o1"],
      }),
      group({
        supplierId: "dt",
        supplierName: "DT",
        person: "B",
        salesPersonId: "2",
        orderIds: ["o2", "o3"],
      }),
    ])[0]!;
    expect(collectProcurementSupplierBlockOrderIds(block)).toEqual(["o1", "o2", "o3"]);
  });

  it("scopeKey jest stabilny per dostawca", () => {
    expect(procurementSupplierBlockScopeKey("uuid-1")).toBe("prosba-block-uuid-1");
  });

  it("tekst potwierdzenia zawiera dostawcę i liczby", () => {
    const block = buildProcurementSupplierBlocks([
      group({ supplierId: "dt", supplierName: "DT Shop", person: "A", salesPersonId: "1" }),
      group({ supplierId: "dt", supplierName: "DT Shop", person: "B", salesPersonId: "2" }),
    ])[0]!;
    const copy = procurementSupplierBlockConfirmCopy(block, "GLOWNE");
    expect(copy.title).toContain("Główne");
    expect(copy.title).toContain("DT Shop");
    expect(copy.message).toContain("2 prośby");
    expect(copy.message).toContain("A, B");
    expect(copy.confirmLabel).toContain("Główne");
    expect(copy.people).toEqual(["A", "B"]);
  });
});
