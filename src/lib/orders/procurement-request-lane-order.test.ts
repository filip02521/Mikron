import { describe, expect, it } from "vitest";
import type { ProcurementFlagDefinition } from "./procurement-request-flag";
import { PROCUREMENT_FLAG_SEED } from "./procurement-request-flag";
import { procurementFlagLaneId } from "./procurement-request-lanes";
import {
  defaultProcurementLaneOrder,
  moveVisibleLaneInOrder,
  normalizeProcurementLaneOrder,
  replaceActiveFlagSequenceInLaneOrder,
} from "./procurement-request-lane-order";

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
    sortOrder: 1,
    isActive: true,
  },
];

describe("defaultProcurementLaneOrder", () => {
  it("triage → flagi → do zamówienia → magazyn → urlop", () => {
    expect(defaultProcurementLaneOrder(defs)).toEqual([
      "triage",
      procurementFlagLaneId(PROCUREMENT_FLAG_SEED.pilne),
      procurementFlagLaneId(PROCUREMENT_FLAG_SEED.wstrzymane),
      "do_zamowienia",
      "magazyn_info",
      "urlop",
    ]);
  });

  it("zawsze zawiera magazyn_info (stockOut filtruje w partition)", () => {
    expect(defaultProcurementLaneOrder(defs)).toContain("magazyn_info");
  });
});

describe("normalizeProcurementLaneOrder", () => {
  it("zachowuje custom order z app_settings, ale triage zawsze pierwsze", () => {
    const saved = [
      "urlop",
      "triage",
      procurementFlagLaneId(PROCUREMENT_FLAG_SEED.pilne),
      "do_zamowienia",
    ];
    const order = normalizeProcurementLaneOrder(saved, defs);
    expect(order[0]).toBe("triage");
    expect(order.indexOf("urlop")).toBeGreaterThan(0);
    expect(order).toContain("magazyn_info");
    expect(order).toContain(procurementFlagLaneId(PROCUREMENT_FLAG_SEED.wstrzymane));
  });

  it("zapis z do_zamowienia na górze i tak stawia triage pierwsze", () => {
    const saved = [
      "do_zamowienia",
      procurementFlagLaneId(PROCUREMENT_FLAG_SEED.pilne),
      "triage",
      "urlop",
    ];
    const order = normalizeProcurementLaneOrder(saved, defs);
    expect(order[0]).toBe("triage");
    expect(order.indexOf("do_zamowienia")).toBeGreaterThan(0);
  });

  it("zapis bez magazyn_info wstawia go przed urlop (ogon systemowy)", () => {
    const saved = [
      "triage",
      procurementFlagLaneId(PROCUREMENT_FLAG_SEED.pilne),
      "do_zamowienia",
      "urlop",
    ];
    const order = normalizeProcurementLaneOrder(saved, defs);
    expect(order.indexOf("do_zamowienia")).toBeLessThan(order.indexOf("magazyn_info"));
    expect(order.indexOf("magazyn_info")).toBeLessThan(order.indexOf("urlop"));
  });
});

describe("moveVisibleLaneInOrder", () => {
  it("przesuwa Do zamówienia nad Urlop wśród widocznych", () => {
    const order = defaultProcurementLaneOrder(defs);
    const visible = [
      procurementFlagLaneId(PROCUREMENT_FLAG_SEED.pilne),
      "do_zamowienia",
      "urlop",
    ] as const;
    const next = moveVisibleLaneInOrder(order, "do_zamowienia", 1, visible);
    expect(next).not.toBeNull();
    const iDo = next!.indexOf("do_zamowienia");
    const iUrlop = next!.indexOf("urlop");
    expect(iUrlop).toBeLessThan(iDo);
    // magazyn_info zostaje w pełnej kolejności mimo że niewidoczny
    expect(next).toContain("magazyn_info");
    expect(next![0]).toBe("triage");
  });

  it("nie pozwala przestawić triage ani wejść nad niego", () => {
    const order = defaultProcurementLaneOrder(defs);
    const visible = [
      "triage",
      "do_zamowienia",
      "urlop",
    ] as const;
    expect(moveVisibleLaneInOrder(order, "triage", 1, visible)).toBeNull();
    expect(moveVisibleLaneInOrder(order, "do_zamowienia", -1, visible)).toBeNull();
  });
});

describe("replaceActiveFlagSequenceInLaneOrder", () => {
  it("przestawia tylko flagi, zostawia system", () => {
    const order = defaultProcurementLaneOrder(defs);
    const next = replaceActiveFlagSequenceInLaneOrder(order, [
      PROCUREMENT_FLAG_SEED.wstrzymane,
      PROCUREMENT_FLAG_SEED.pilne,
    ]);
    expect(next.indexOf("triage")).toBe(0);
    expect(next.indexOf(procurementFlagLaneId(PROCUREMENT_FLAG_SEED.wstrzymane))).toBe(
      1
    );
    expect(next.indexOf(procurementFlagLaneId(PROCUREMENT_FLAG_SEED.pilne))).toBe(2);
    expect(next.indexOf("do_zamowienia")).toBe(3);
  });
});
