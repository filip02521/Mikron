import { describe, expect, it } from "vitest";
import { prosbaLineOffersStockOutReport } from "./prosba-stock-out-report";
import { formatInformacjaDuplicateMessage, isStockOutAlreadyReportedMessage } from "./informacja-duplicate";

const base = { subiektTwId: 7, onHand: 0, reserved: 0, available: 0, stockSource: "subiekt" as const, teethManufacturer: null };

describe("prosbaLineOffersStockOutReport", () => {
  it("pusta półka albo wszystko zarezerwowane: proponuje zgłoszenie", () => {
    expect(prosbaLineOffersStockOutReport(base)).toBe(true);
    expect(prosbaLineOffersStockOutReport({ ...base, onHand: 3, reserved: 3, available: 0 })).toBe(true);
    expect(prosbaLineOffersStockOutReport({ ...base, onHand: 1, reserved: 3, available: -2 })).toBe(true);
  });

  it("towar na półce, brak stanu z Subiekta, towar spoza Subiekta, zęby: bez panelu", () => {
    expect(prosbaLineOffersStockOutReport({ ...base, onHand: 2, available: 2 })).toBe(false);
    expect(prosbaLineOffersStockOutReport({ ...base, stockSource: null })).toBe(false);
    expect(prosbaLineOffersStockOutReport({ ...base, subiektTwId: null })).toBe(false);
    expect(prosbaLineOffersStockOutReport({ ...base, teethManufacturer: "wiedent" as never })).toBe(false);
  });
});

describe("isStockOutAlreadyReportedMessage", () => {
  it("rozpoznaje komunikat duplikatu braku, nie myli z innymi", () => {
    const msg = formatInformacjaDuplicateMessage({ symbol: "S", product: "P", informacja_stock_out_reorder: true });
    expect(isStockOutAlreadyReportedMessage(msg)).toBe(true);
    expect(isStockOutAlreadyReportedMessage(formatInformacjaDuplicateMessage({ symbol: "S", product: "P" }))).toBe(false);
    expect(isStockOutAlreadyReportedMessage("Wymagane logowanie")).toBe(false);
  });
});
