import { describe, expect, it } from "vitest";
import type { SummaryForSomeoneEnriched } from "./summary-workspace";
import { buildProcurementSupplierBlocks } from "./procurement-supplier-groups";
import {
  countProcurementBlockGroups,
  filterProcurementGroupsForLaneDisplay,
  isProcurementLaneExpanded,
  isProcurementLanePeekGroup,
  isProcurementLanePeekPartialSupplier,
  procurementLaneCountLabel,
  procurementLaneDisplayBlocks,
  resolveProcurementLaneChrome,
} from "./procurement-request-lane-collapse";

function group(
  partial: Partial<SummaryForSomeoneEnriched> &
    Pick<SummaryForSomeoneEnriched, "supplierId" | "salesPersonId" | "person" | "hasUnseen">
): SummaryForSomeoneEnriched {
  return {
    kind: "forSomeone",
    supplierName: "Dostawca",
    flaggedName: "Dostawca",
    location: "POLSKA",
    displayText: "",
    hoverNote: "",
    lines: [],
    orderIds: [`o-${partial.salesPersonId}`],
    shift: "[DLA KOGOŚ]",
    status: "-",
    nextDate: new Date(),
    submittedAt: "2026-05-28T10:00:00",
    submittedAtLatest: "2026-05-28T10:00:00",
    unseenCount: partial.hasUnseen ? 1 : 0,
    supplierOrderOnDemand: false,
    ...partial,
  };
}

const hints = {
  peekHint: "tylko nowe",
  allNewHint: "wszystkie nowe",
  emptyCollapsedHint: "rozwiń wszystkie",
};

describe("procurement-request-lane-collapse", () => {
  it("domyślnie tor nie jest rozwinięty", () => {
    expect(isProcurementLaneExpanded("do_zamowienia", new Set())).toBe(false);
    expect(
      isProcurementLaneExpanded("do_zamowienia", new Set(["do_zamowienia"]))
    ).toBe(true);
  });

  it("peek opiera się o hasUnseen z serwera (nie lokalny badge)", () => {
    expect(isProcurementLanePeekGroup({ hasUnseen: true })).toBe(true);
    expect(isProcurementLanePeekGroup({ hasUnseen: false })).toBe(false);
  });

  it("zwinięty tor filtruje do nieprzeczytanych", () => {
    const groups = [
      group({
        supplierId: "s1",
        salesPersonId: "a",
        person: "A",
        hasUnseen: true,
      }),
      group({
        supplierId: "s1",
        salesPersonId: "b",
        person: "B",
        hasUnseen: false,
      }),
      group({
        supplierId: "s2",
        salesPersonId: "c",
        person: "C",
        hasUnseen: false,
      }),
    ];

    expect(filterProcurementGroupsForLaneDisplay(groups, false)).toEqual([groups[0]]);
    expect(filterProcurementGroupsForLaneDisplay(groups, true)).toEqual(groups);
  });

  it("display blocks: zwinięty bez nowych → pusto; z nowymi → tylko one", () => {
    const groups = [
      group({
        supplierId: "s1",
        salesPersonId: "a",
        person: "A",
        hasUnseen: true,
      }),
      group({
        supplierId: "s1",
        salesPersonId: "b",
        person: "B",
        hasUnseen: false,
      }),
      group({
        supplierId: "s2",
        salesPersonId: "c",
        person: "C",
        hasUnseen: false,
      }),
    ];
    const blocks = buildProcurementSupplierBlocks(groups);

    expect(procurementLaneDisplayBlocks(blocks, true)).toEqual(blocks);

    const peek = procurementLaneDisplayBlocks(blocks, false);
    expect(countProcurementBlockGroups(peek)).toBe(1);
    expect(peek[0]?.requestGroups[0]?.person).toBe("A");
    expect(peek.every((b) => b.requestGroups.length < 2)).toBe(true);

    const noUnseen = buildProcurementSupplierBlocks(
      groups.filter((g) => !g.hasUnseen)
    );
    expect(procurementLaneDisplayBlocks(noUnseen, false)).toEqual([]);
  });

  it("resolveProcurementLaneChrome: expanded / peek / closed", () => {
    const closed = resolveProcurementLaneChrome({
      laneExpanded: false,
      totalGroupCount: 5,
      peekGroupCount: 0,
      ...hints,
    });
    expect(closed.mode).toBe("closed");
    expect(closed.bodyOpen).toBe(false);
    expect(closed.chromeCollapsed).toBe(true);
    expect(closed.subtitle).toBe(hints.emptyCollapsedHint);
    expect(closed.countLabel).toBe("5");

    const partial = resolveProcurementLaneChrome({
      laneExpanded: false,
      totalGroupCount: 5,
      peekGroupCount: 2,
      ...hints,
    });
    expect(partial.mode).toBe("peek");
    expect(partial.bodyOpen).toBe(true);
    expect(partial.subtitle).toBe(hints.peekHint);
    expect(partial.countLabel).toBe("2/5");

    const allNew = resolveProcurementLaneChrome({
      laneExpanded: false,
      totalGroupCount: 3,
      peekGroupCount: 3,
      ...hints,
    });
    expect(allNew.mode).toBe("peek");
    expect(allNew.subtitle).toBe(hints.allNewHint);
    expect(allNew.countLabel).toBe("3");

    const expanded = resolveProcurementLaneChrome({
      laneExpanded: true,
      totalGroupCount: 5,
      peekGroupCount: 0,
      ...hints,
    });
    expect(expanded.mode).toBe("expanded");
    expect(expanded.bodyOpen).toBe(true);
    expect(expanded.chromeCollapsed).toBe(false);
    expect(expanded.subtitle).toBeNull();
  });

  it("count label częściowego peeka", () => {
    expect(
      procurementLaneCountLabel({
        laneExpanded: false,
        totalGroupCount: 4,
        peekGroupCount: 1,
      })
    ).toBe("1/4");
    expect(
      procurementLaneCountLabel({
        laneExpanded: true,
        totalGroupCount: 4,
        peekGroupCount: 1,
      })
    ).toBe("4");
  });

  it("peek partial supplier — Zamów razem tylko nowe", () => {
    const groups = [
      group({
        supplierId: "s1",
        salesPersonId: "a",
        person: "A",
        hasUnseen: true,
      }),
      group({
        supplierId: "s1",
        salesPersonId: "b",
        person: "B",
        hasUnseen: false,
      }),
    ];
    const fullBlocks = buildProcurementSupplierBlocks(groups);
    const peekBlocks = procurementLaneDisplayBlocks(fullBlocks, false);
    expect(
      isProcurementLanePeekPartialSupplier({
        laneExpanded: false,
        fullBlock: fullBlocks[0],
        displayBlock: peekBlocks[0]!,
      })
    ).toBe(true);
    expect(
      isProcurementLanePeekPartialSupplier({
        laneExpanded: true,
        fullBlock: fullBlocks[0],
        displayBlock: fullBlocks[0]!,
      })
    ).toBe(false);
  });
});
