import { describe, expect, it } from "vitest";
import { PROCUREMENT_FLAG_SEED } from "./procurement-request-flag";
import {
  applyProcurementFlagPatchesToGroups,
  buildProcurementFlagPatchesForOrderIds,
  pruneSyncedProcurementFlagPatches,
} from "./procurement-flag-optimistic";
import {
  assignProcurementRequestLane,
  type ProcurementRequestLaneGroupFields,
} from "./procurement-request-lanes";

function group(
  overrides: Partial<ProcurementRequestLaneGroupFields> = {}
): ProcurementRequestLaneGroupFields {
  return {
    supplierId: "sup-1",
    salesPersonId: "sp-1",
    hasUnseen: true,
    lines: [{ id: "o1", products: "X", symbol: "S1" }],
    ...overrides,
  };
}

describe("applyProcurementFlagPatchesToGroups", () => {
  it("ustawia flagę na liniach i zmienia tor od razu", () => {
    const groups = [group({ hasUnseen: true })];
    expect(
      assignProcurementRequestLane(groups[0]!, {
        variant: "requests",
        suppliersOnVacationNow: {},
      })
    ).toBe("triage");

    const patched = applyProcurementFlagPatchesToGroups(
      groups,
      buildProcurementFlagPatchesForOrderIds(
        ["o1"],
        PROCUREMENT_FLAG_SEED.pilne
      )
    );
    expect(patched[0]!.lines[0]!.procurementFlag).toBe(PROCUREMENT_FLAG_SEED.pilne);
    expect(
      assignProcurementRequestLane(patched[0]!, {
        variant: "requests",
        suppliersOnVacationNow: {},
      })
    ).toBe(`flag:${PROCUREMENT_FLAG_SEED.pilne}`);
  });

  it("czyszczenie flagi wraca do triage gdy hasUnseen", () => {
    const groups = [
      group({
        hasUnseen: true,
        lines: [
          {
            id: "o1",
            products: "X",
            symbol: "S1",
            procurementFlag: PROCUREMENT_FLAG_SEED.wstrzymane,
          },
        ],
      }),
    ];
    const patched = applyProcurementFlagPatchesToGroups(
      groups,
      buildProcurementFlagPatchesForOrderIds(["o1"], null)
    );
    expect(
      assignProcurementRequestLane(patched[0]!, {
        variant: "requests",
        suppliersOnVacationNow: {},
      })
    ).toBe("triage");
  });
});

describe("pruneSyncedProcurementFlagPatches", () => {
  it("usuwa patch gdy serwer dogonił flagę", () => {
    const groups = [
      group({
        lines: [
          {
            id: "o1",
            products: "X",
            symbol: "S1",
            procurementFlag: PROCUREMENT_FLAG_SEED.pilne,
          },
        ],
      }),
    ];
    const patches = buildProcurementFlagPatchesForOrderIds(
      ["o1"],
      PROCUREMENT_FLAG_SEED.pilne
    );
    expect(pruneSyncedProcurementFlagPatches(groups, patches).size).toBe(0);
  });

  it("zostawia patch gdy serwer jeszcze stary", () => {
    const groups = [group()];
    const patches = buildProcurementFlagPatchesForOrderIds(
      ["o1"],
      PROCUREMENT_FLAG_SEED.pilne
    );
    expect(pruneSyncedProcurementFlagPatches(groups, patches).size).toBe(1);
  });
});

describe("buildProcurementFlagPatchesForOrderIds", () => {
  it("nie buduje patcha z nieparsowalną flagą", () => {
    expect(
      buildProcurementFlagPatchesForOrderIds(["o1"], "not-a-uuid").size
    ).toBe(0);
  });
});
