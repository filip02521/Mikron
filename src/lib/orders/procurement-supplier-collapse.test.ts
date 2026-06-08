import { describe, expect, it } from "vitest";
import type { SummaryForSomeoneEnriched } from "./summary-workspace";
import type { ProcurementSupplierBlock } from "./procurement-supplier-groups";
import {
  allCollapsibleProcurementBlocksExpanded,
  collapsedProcurementSupplierIds,
  isProcurementSupplierBlockCollapsed,
  shouldDefaultCollapseProcurementBlock,
} from "./procurement-supplier-collapse";

function personGroup(
  supplierId: string,
  person: string,
  salesPersonId: string,
  hasUnseen = false
): SummaryForSomeoneEnriched {
  return {
    kind: "forSomeone",
    supplierId,
    salesPersonId,
    supplierName: "Dostawca",
    flaggedName: "Dostawca",
    location: "POLSKA",
    person,
    displayText: "",
    hoverNote: "",
    lines: [],
    orderIds: [`o-${salesPersonId}`],
    shift: "[DLA KOGOŚ]",
    status: "-",
    nextDate: new Date(),
    submittedAt: "2026-05-28T10:00:00",
    submittedAtLatest: "2026-05-28T10:00:00",
    hasUnseen,
    unseenCount: hasUnseen ? 1 : 0,
    supplierOrderOnDemand: false,
  };
}

function block(
  supplierId: string,
  people: string[],
  hasUnseen = false
): ProcurementSupplierBlock {
  const requestGroups = people.map((person, i) =>
    personGroup(supplierId, person, `sp${i}`, hasUnseen && i === 0)
  );
  return {
    supplierId,
    supplierName: "Dostawca",
    location: "POLSKA",
    requestGroups,
    lineCount: people.length,
    unseenGroupCount: hasUnseen ? 1 : 0,
    hasUnseen,
    earliestSubmittedAt: "2026-05-28T10:00:00",
    supplierOrderOnDemand: false,
  };
}

describe("procurement-supplier-collapse", () => {
  it("domyślnie zwija 3+ grupy bez nowych", () => {
    const b = block("a", ["Kasia", "Jan", "Ola"]);
    expect(shouldDefaultCollapseProcurementBlock(b)).toBe(true);
    expect(isProcurementSupplierBlockCollapsed(b, new Map())).toBe(true);
  });

  it("2 grupy — domyślnie rozwinięte", () => {
    const b = block("b", ["Kasia", "Jan"]);
    expect(shouldDefaultCollapseProcurementBlock(b)).toBe(false);
    expect(isProcurementSupplierBlockCollapsed(b, new Map())).toBe(false);
  });

  it("nowe prośby — zawsze rozwinięte", () => {
    const b = block("c", ["Kasia", "Jan", "Ola", "Piotr"], true);
    expect(isProcurementSupplierBlockCollapsed(b, new Map([["c", true]]))).toBe(false);
  });

  it("ręczne rozwinięcie nadpisuje domyślne zwinięcie", () => {
    const b = block("d", ["A", "B", "C"]);
    expect(isProcurementSupplierBlockCollapsed(b, new Map([["d", false]]))).toBe(false);
  });

  it("collapsedProcurementSupplierIds i bulk expanded", () => {
    const blocks = [block("e", ["A", "B", "C"]), block("f", ["X", "Y"])];
    const collapsed = collapsedProcurementSupplierIds(blocks, new Map());
    expect([...collapsed]).toEqual(["e"]);
    expect(allCollapsibleProcurementBlocksExpanded(blocks, new Map())).toBe(false);
    expect(
      allCollapsibleProcurementBlocksExpanded(
        blocks,
        new Map([
          ["e", false],
          ["f", false],
        ])
      )
    ).toBe(true);
  });

  it("lokalnie nieprzeczytane — wymusza rozwinięcie mimo domyślnego zwinięcia", () => {
    const b = block("g", ["A", "B", "C"]);
    expect(
      isProcurementSupplierBlockCollapsed(b, new Map(), new Set(["g"]))
    ).toBe(false);
    expect(
      collapsedProcurementSupplierIds([b], new Map(), new Set(["g"]))
    ).toEqual(new Set());
  });
});
