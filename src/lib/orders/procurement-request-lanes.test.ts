import { describe, expect, it } from "vitest";
import {
  PROCUREMENT_FLAG_SEED,
  type ProcurementFlagDefinition,
} from "./procurement-request-flag";
import {
  assignProcurementRequestLane,
  highestFixedLaneFlagId,
  highestFlagIdForLane,
  partitionForSomeoneGroups,
  procurementFlagLaneId,
  procurementRequestGroupKey,
  resolveProcurementRequestGroupPath,
  type ProcurementRequestLaneGroupFields,
} from "./procurement-request-lanes";

function group(
  overrides: Partial<ProcurementRequestLaneGroupFields> & {
    lines?: ProcurementRequestLaneGroupFields["lines"];
  } = {}
): ProcurementRequestLaneGroupFields {
  return {
    supplierId: "sup-1",
    salesPersonId: "sp-1",
    hasUnseen: false,
    lines: [{ id: "o1", products: "X", symbol: "S1" }],
    ...overrides,
  };
}

const customFlagId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const defs: ProcurementFlagDefinition[] = [
  {
    id: PROCUREMENT_FLAG_SEED.pilne,
    label: "Pilne",
    color: "rose",
    sortOrder: 0,
    isActive: true,
  },
  {
    id: PROCUREMENT_FLAG_SEED.wstrzymane,
    label: "Wstrzymane",
    color: "slate",
    sortOrder: 4,
    isActive: true,
  },
  {
    id: customFlagId,
    label: "Gądek",
    color: "fuchsia",
    sortOrder: 10,
    isActive: true,
  },
];

describe("highestFixedLaneFlagId", () => {
  it("wybiera silniejszą flagę (Pilne > Wstrzymane)", () => {
    expect(
      highestFixedLaneFlagId([
        {
          id: "a",
          products: "A",
          symbol: "A",
          procurementFlag: PROCUREMENT_FLAG_SEED.wstrzymane,
        },
        {
          id: "b",
          products: "B",
          symbol: "B",
          procurementFlag: PROCUREMENT_FLAG_SEED.pilne,
        },
      ])
    ).toBe(PROCUREMENT_FLAG_SEED.pilne);
  });

  it("ignoruje custom poza FIXED map", () => {
    expect(
      highestFixedLaneFlagId([
        {
          id: "a",
          products: "A",
          symbol: "A",
          procurementFlag: customFlagId,
        },
      ])
    ).toBeNull();
  });
});

describe("highestFlagIdForLane", () => {
  it("wybiera wg sort_order (Zarządzaj), nie FIXED", () => {
    const sortById = {
      [PROCUREMENT_FLAG_SEED.wstrzymane]: 0,
      [PROCUREMENT_FLAG_SEED.pilne]: 5,
    };
    expect(
      highestFlagIdForLane(
        [
          {
            id: "a",
            products: "A",
            symbol: "A",
            procurementFlag: PROCUREMENT_FLAG_SEED.pilne,
          },
          {
            id: "b",
            products: "B",
            symbol: "B",
            procurementFlag: PROCUREMENT_FLAG_SEED.wstrzymane,
          },
        ],
        sortById
      )
    ).toBe(PROCUREMENT_FLAG_SEED.wstrzymane);
  });
});

describe("assignProcurementRequestLane", () => {
  const emptyVac = {};

  it("Pilne → tor flag:uuid", () => {
    expect(
      assignProcurementRequestLane(
        group({
          lines: [
            {
              id: "a",
              products: "A",
              symbol: "A",
              procurementFlag: PROCUREMENT_FLAG_SEED.pilne,
            },
          ],
        }),
        {
          variant: "requests",
          suppliersOnVacationNow: { "sup-1": { startDate: "2026-01-01", endDate: "2026-01-10" } },
        }
      )
    ).toBe(procurementFlagLaneId(PROCUREMENT_FLAG_SEED.pilne));
  });

  it("custom flaga → własny tor flag:uuid", () => {
    expect(
      assignProcurementRequestLane(
        group({
          lines: [
            {
              id: "a",
              products: "A",
              symbol: "A",
              procurementFlag: customFlagId,
            },
          ],
        }),
        { variant: "requests", suppliersOnVacationNow: emptyVac }
      )
    ).toBe(procurementFlagLaneId(customFlagId));
  });

  it("urlop bez flagi", () => {
    expect(
      assignProcurementRequestLane(group(), {
        variant: "requests",
        suppliersOnVacationNow: { "sup-1": { startDate: "2026-01-01", endDate: "2026-01-10" } },
      })
    ).toBe("urlop");
  });

  it("via_panel bez flagi → magazyn_info (requests)", () => {
    expect(
      assignProcurementRequestLane(
        group({
          lines: [
            {
              id: "a",
              products: "A",
              symbol: "A",
              informacjaViaPanel: true,
            },
          ],
        }),
        { variant: "requests", suppliersOnVacationNow: emptyVac }
      )
    ).toBe("magazyn_info");
  });

  it("via_panel w stockOut nie tworzy magazyn_info — idzie do zamówienia/triage", () => {
    expect(
      assignProcurementRequestLane(
        group({
          hasUnseen: false,
          lines: [
            {
              id: "a",
              products: "A",
              symbol: "A",
              informacjaViaPanel: true,
              informacjaStockOut: true,
            },
          ],
        }),
        { variant: "stockOut", suppliersOnVacationNow: emptyVac }
      )
    ).toBe("do_zamowienia");
  });

  it("unseen bez flagi → triage", () => {
    expect(
      assignProcurementRequestLane(group({ hasUnseen: true }), {
        variant: "requests",
        suppliersOnVacationNow: emptyVac,
      })
    ).toBe("triage");
  });

  it("seen bez flagi → do_zamowienia", () => {
    expect(
      assignProcurementRequestLane(group({ hasUnseen: false }), {
        variant: "requests",
        suppliersOnVacationNow: emptyVac,
      })
    ).toBe("do_zamowienia");
  });
});

describe("partitionForSomeoneGroups", () => {
  it("każda grupa w dokładnie jednym torze; puste tory pomijane", () => {
    const groups = [
      group({ hasUnseen: true, salesPersonId: "a" }),
      group({
        hasUnseen: false,
        salesPersonId: "b",
        lines: [
          {
            id: "x",
            products: "X",
            symbol: "X",
            procurementFlag: PROCUREMENT_FLAG_SEED.wstrzymane,
          },
        ],
      }),
      group({
        hasUnseen: false,
        salesPersonId: "d",
        lines: [
          {
            id: "y",
            products: "Y",
            symbol: "Y",
            procurementFlag: customFlagId,
          },
        ],
      }),
      group({ hasUnseen: false, salesPersonId: "c" }),
    ];
    const buckets = partitionForSomeoneGroups(groups, {
      variant: "requests",
      suppliersOnVacationNow: {},
      flagDefinitions: defs,
    });
    expect(buckets.map((b) => b.laneId)).toEqual([
      "triage",
      procurementFlagLaneId(PROCUREMENT_FLAG_SEED.wstrzymane),
      procurementFlagLaneId(customFlagId),
      "do_zamowienia",
    ]);
    expect(buckets.find((b) => b.laneId.endsWith(customFlagId))?.color).toBe("fuchsia");
    expect(buckets.find((b) => b.laneId.endsWith(customFlagId))?.label).toBe("Gądek");
    expect(buckets.reduce((n, b) => n + b.groups.length, 0)).toBe(4);
  });

  it("stockOut nie emituje magazyn_info", () => {
    const buckets = partitionForSomeoneGroups(
      [
        group({
          lines: [{ id: "a", products: "A", symbol: "A", informacjaViaPanel: true }],
        }),
      ],
      { variant: "stockOut", suppliersOnVacationNow: {} }
    );
    expect(buckets.some((b) => b.laneId === "magazyn_info")).toBe(false);
    expect(buckets.map((b) => b.laneId)).toEqual(["do_zamowienia"]);
  });
});

describe("procurementRequestGroupKey", () => {
  it("rozróżnia zamowienie i via_panel", () => {
    const a = group({
      lines: [{ id: "1", products: "A", symbol: "A" }],
    });
    const b = group({
      lines: [{ id: "2", products: "B", symbol: "B", informacjaViaPanel: true }],
    });
    expect(resolveProcurementRequestGroupPath(a, "requests")).toBe("zamowienie");
    expect(resolveProcurementRequestGroupPath(b, "requests")).toBe("via_panel");
    expect(procurementRequestGroupKey(a, "requests")).not.toBe(
      procurementRequestGroupKey(b, "requests")
    );
  });
});
