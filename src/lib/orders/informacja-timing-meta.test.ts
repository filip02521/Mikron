import { describe, expect, it } from "vitest";
import {
  buildInformacjaTimingMetaDisplay,
  shouldShowInformacjaTimingMeta,
} from "@/lib/orders/informacja-timing-meta";

describe("buildInformacjaTimingMetaDisplay", () => {
  it("parsuje e-mail z magazynu", () => {
    expect(buildInformacjaTimingMetaDisplay("E-mail 18.06.2026")).toEqual({
      kind: "available",
      caption: "Dostępne od",
      dateLabel: "18.06.2026",
      title: "Magazyn potwierdził dostępność towaru 18.06.2026",
    });
  });

  it("parsuje zamówienie u dostawcy", () => {
    expect(buildInformacjaTimingMetaDisplay("Zamówione 12.05.2026")).toEqual({
      kind: "ordered_at_supplier",
      caption: "Zamówione u dostawcy",
      dateLabel: "12.05.2026",
      title: "Zamówienie u dostawcy złożone 12.05.2026",
    });
  });

  it("ignoruje inne etykiety", () => {
    expect(buildInformacjaTimingMetaDisplay("ok. 10.05.2026")).toBeNull();
  });
});

describe("shouldShowInformacjaTimingMeta", () => {
  it("pokazuje meta dla informacji z datą e-mail", () => {
    expect(
      shouldShowInformacjaTimingMeta({
        kind: "informacja",
        timingLabel: "E-mail 2026-06-18",
      })
    ).toBe(true);
  });

  it("pokazuje meta dla informacji z datą zamówienia", () => {
    expect(
      shouldShowInformacjaTimingMeta({
        kind: "informacja",
        timingLabel: "Zamówione 12.05.2026",
      })
    ).toBe(true);
  });

  it("ukrywa meta dla zamówień", () => {
    expect(
      shouldShowInformacjaTimingMeta({
        kind: "zamowienie",
        timingLabel: "E-mail 2026-06-18",
      })
    ).toBe(false);
  });
});
