import { describe, expect, it } from "vitest";
import {
  buildDeliveryDateMetaDisplay,
  buildHistoryEstimateDateMetaDisplay,
  parseDeliveryEstimateFromTimingLabel,
  resolveLineHistoryEstimateFromTimingLabel,
  resolveMyOrderHistoryDeliveryEstimate,
  MY_ORDER_HISTORY_ESTIMATE_OVERDUE_LABEL,
} from "@/lib/orders/delivery-date-meta-label";
import { parseDateOnly } from "@/lib/orders/dates";

describe("buildDeliveryDateMetaDisplay", () => {
  it("pokazuje Dziś z datą skróconą", () => {
    expect(
      buildDeliveryDateMetaDisplay(parseDateOnly("2026-06-18")!, {
        todayDateKey: "2026-06-18",
      })
    ).toEqual({
      primaryLabel: "Dziś",
      detailLabel: "18.06",
      overdue: false,
      title: "Planowana dostawa dziś · 18.06.2026",
    });
  });

  it("pokazuje Jutro", () => {
    expect(
      buildDeliveryDateMetaDisplay(parseDateOnly("2026-06-19")!, {
        todayDateKey: "2026-06-18",
      }).primaryLabel
    ).toBe("Jutro");
  });

  it("pokazuje Po terminie dla minionych dat", () => {
    const display = buildDeliveryDateMetaDisplay(parseDateOnly("2026-06-10")!, {
      todayDateKey: "2026-06-18",
    });
    expect(display.primaryLabel).toBe("Po terminie");
    expect(display.overdue).toBe(true);
    expect(display.detailLabel).toBe("10.06.2026");
  });

  it("dodaje szacunek dni roboczych w detalu", () => {
    expect(
      buildDeliveryDateMetaDisplay(parseDateOnly("2026-08-01")!, {
        todayDateKey: "2026-06-18",
        avgBusinessDays: 5,
        lowConfidence: true,
      }).detailLabel
    ).toBe("~5 dni rob. · mało historii");
  });
});

describe("parseDeliveryEstimateFromTimingLabel", () => {
  it("parsuje timingLabel z presentera", () => {
    expect(
      parseDeliveryEstimateFromTimingLabel("ok. 22.06.2026 (~5 dni rob.) · po terminie")
    ).toEqual({
      expectedDate: parseDateOnly("2026-06-22"),
      avgBusinessDays: 5,
      lowConfidence: false,
      overdue: true,
    });
  });
});

describe("buildHistoryEstimateDateMetaDisplay", () => {
  it("oznacza tytuł jako termin z historii dostaw", () => {
    const display = buildHistoryEstimateDateMetaDisplay(parseDateOnly("2026-08-01")!, {
      todayDateKey: "2026-06-18",
      avgBusinessDays: 5,
    });
    expect(display.title).toContain("Termin z historii dostaw");
  });

  it("zamienia przeterminowany termin z historii na brak informacji", () => {
    const display = buildHistoryEstimateDateMetaDisplay(parseDateOnly("2026-06-10")!, {
      todayDateKey: "2026-06-18",
    });
    expect(display.primaryLabel).toBe(MY_ORDER_HISTORY_ESTIMATE_OVERDUE_LABEL);
    expect(display.detailLabel).toBeNull();
    expect(display.overdue).toBe(true);
  });
});

describe("resolveMyOrderHistoryDeliveryEstimate", () => {
  it("zwraca szacunek z historii gdy brak ZD", () => {
    const result = resolveMyOrderHistoryDeliveryEstimate({
      timingLabel: "ok. 10.05.2026 (~5 dni rob.)",
    });
    expect(result?.parsed.avgBusinessDays).toBe(5);
    expect(result?.display.primaryLabel).toBeTruthy();
  });

  it("pomija etykietę ZD i pusty timingLabel", () => {
    expect(
      resolveMyOrderHistoryDeliveryEstimate({
        timingLabel: "15.07.2026 · ZD/1",
      })
    ).toBeNull();
    expect(resolveMyOrderHistoryDeliveryEstimate({ timingLabel: null })).toBeNull();
    expect(
      resolveMyOrderHistoryDeliveryEstimate({
        timingLabel: "ok. 10.05.2026",
        zdFulfillment: { deadline: "2026-07-01" },
      })
    ).toBeNull();
  });
});

describe("resolveLineHistoryEstimateFromTimingLabel", () => {
  it("wyciąga szacunek z historii dla pozycji bez ZD", () => {
    const result = resolveLineHistoryEstimateFromTimingLabel(
      "ok. 22.06.2026 (~5 dni rob.) · mało historii",
      { zdEtaNoMatch: true }
    );
    expect(result?.label).toBe("ok. 22.06.2026 (~5 dni rob.)");
    expect(result?.lowConfidence).toBe(true);
  });

  it("pomija gdy pozycja ma dopasowany ZD", () => {
    expect(
      resolveLineHistoryEstimateFromTimingLabel("ok. 22.06.2026 (~5 dni rob.)", {
        zdFulfillment: { deadline: "2026-06-24" },
        zdEtaNoMatch: true,
      })
    ).toBeNull();
  });
});
