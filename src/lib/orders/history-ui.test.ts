import { describe, expect, it } from "vitest";
import {
  individualHistoryRowClass,
  individualHistoryStatusBadgeVariant,
  individualHistoryStatusLabel,
  normalHistoryActionPresentation,
} from "./history-ui";

describe("individualHistoryStatusLabel", () => {
  it("mapuje statusy na czytelne etykiety", () => {
    expect(individualHistoryStatusLabel("Czesciowo_zrealizowane")).toBe("Częściowo");
    expect(individualHistoryStatusLabel("Zrealizowane")).toBe("Zrealizowane");
  });
});

describe("individualHistoryStatusBadgeVariant", () => {
  it("przypisuje warianty semantyczne", () => {
    expect(individualHistoryStatusBadgeVariant("Zrealizowane")).toBe("success");
    expect(individualHistoryStatusBadgeVariant("Czesciowo_zrealizowane")).toBe("warning");
    expect(individualHistoryStatusBadgeVariant("Anulowane")).toBe("danger");
  });
});

describe("individualHistoryRowClass", () => {
  it("bez kolorowego paska; anulowane wyszarzone", () => {
    expect(individualHistoryRowClass("Zamowione")).not.toContain("border-l-");
    expect(individualHistoryRowClass("Anulowane")).toContain("opacity-70");
  });
});

describe("normalHistoryActionPresentation", () => {
  it("oznacza zamówienie i przesunięcie", () => {
    expect(normalHistoryActionPresentation("Zamówione").badgeVariant).toBe("info");
    expect(normalHistoryActionPresentation("Przesunięte o 3 tyg.").badgeVariant).toBe(
      "warning"
    );
  });
});
