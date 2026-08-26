import { describe, expect, it } from "vitest";
import {
  buildProsbaFormLeadTimeMeta,
  collectProsbaLeadTimeSupplierIds,
  PROSBA_FORM_LEAD_TIME_TOOLTIP,
} from "@/lib/orders/prosba-form-lead-time";
import type { DeliveryStats } from "@/types/database";

const stats: DeliveryStats = {
  supplier_id: "x",
  main_sum: 20,
  main_count: 2,
  main_avg: 10,
  side_sum: 10,
  side_count: 2,
  side_avg: 5,
};

describe("buildProsbaFormLeadTimeMeta", () => {
  it("zwraca null bez historii", () => {
    expect(buildProsbaFormLeadTimeMeta(null, "LACZNIE")).toBeNull();
  });

  it("LACZNIE — brief + liczba dostaw", () => {
    const m = buildProsbaFormLeadTimeMeta(stats, "LACZNIE");
    expect(m).toEqual({
      primaryText: "~8 dni rob.",
      sampleText: "4 dostawy",
      lowConfidence: true,
      tooltip: PROSBA_FORM_LEAD_TIME_TOOLTIP,
    });
  });

  it("OSOBNO — gł./pob. z lowConfidence przy n<5", () => {
    const m = buildProsbaFormLeadTimeMeta(stats, "OSOBNO");
    expect(m?.primaryText).toBe("gł. ~10 d · pob. ~5 d");
    expect(m?.lowConfidence).toBe(true);
  });

  it("lowConfidence przy <5 próbach — bez „szacunek” w primaryText", () => {
    const thin: DeliveryStats = {
      supplier_id: "x",
      main_sum: 10,
      main_count: 2,
      main_avg: 5,
      side_sum: 0,
      side_count: 0,
      side_avg: 0,
    };
    const m = buildProsbaFormLeadTimeMeta(thin, "LACZNIE");
    expect(m?.primaryText).toBe("~5 dni rob.");
    expect(m?.lowConfidence).toBe(true);
    expect(m?.sampleText).toBe("2 dostawy");
  });
});

describe("collectProsbaLeadTimeSupplierIds", () => {
  it("zbiera unikalne ID z linii", () => {
    expect(
      collectProsbaLeadTimeSupplierIds([
        { supplierId: "a" },
        { supplierId: "a" },
        { supplierId: "b" },
        { supplierId: "" },
      ])
    ).toEqual(["a", "b"]);
  });

  it("używa fallback gdy linie bez dostawcy", () => {
    expect(collectProsbaLeadTimeSupplierIds([{ supplierId: "" }], "sched")).toEqual([
      "sched",
    ]);
  });

  it("nie dokłada fallback gdy linie mają dostawcę", () => {
    expect(collectProsbaLeadTimeSupplierIds([{ supplierId: "a" }], "sched")).toEqual([
      "a",
    ]);
  });
});
