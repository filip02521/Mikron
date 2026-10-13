import { describe, expect, it } from "vitest";
import {
  stockWatchHorizonDays,
  stockWatchHorizonExtends,
  stockWatchPrepareZdUsesHorizon,
  stockWatchSignalStale,
} from "./signal";

describe("stockWatchHorizonExtends", () => {
  it("true, gdy dni do kolejnego zamówienia + dostawa przekraczają zapas", () => {
    expect(stockWatchHorizonExtends({ leadDays: 9, nextOrderDays: 21, dniZapasu: 28 })).toBe(true);
  });

  it("false przy równości (zapas akurat wystarcza)", () => {
    expect(stockWatchHorizonExtends({ leadDays: 7, nextOrderDays: 21, dniZapasu: 28 })).toBe(false);
  });

  it("false, gdy brak czasu dostawy albo terminu kolejnego zamówienia", () => {
    expect(stockWatchHorizonExtends({ leadDays: null, nextOrderDays: 30, dniZapasu: 1 })).toBe(false);
    expect(stockWatchHorizonExtends({ leadDays: 30, nextOrderDays: null, dniZapasu: 1 })).toBe(false);
  });

  it("zero dni nie jest traktowane jak brak danych", () => {
    expect(stockWatchHorizonExtends({ leadDays: 0, nextOrderDays: 0, dniZapasu: 0 })).toBe(false);
    expect(stockWatchHorizonExtends({ leadDays: 1, nextOrderDays: 0, dniZapasu: 0 })).toBe(true);
  });
});

describe("horyzont liczony od dziś", () => {
  it("dni do zamówienia z daty planu, nie z dnia analizy", () => {
    const s = { leadDays: 9, nextOrderDate: "2026-10-15", nextOrderDays: 5, dniZapasu: 11 };
    expect(stockWatchHorizonDays(s, "2026-10-12")).toBe(12);
    expect(stockWatchHorizonExtends(s, "2026-10-12")).toBe(true);
    expect(stockWatchHorizonExtends(s, "2026-10-14")).toBe(false);
  });

  it("„Przygotuj ZD” z horyzontem, gdy są tylko pozycje zagrożone przed dostawą", () => {
    expect(stockWatchPrepareZdUsesHorizon({ lineCount: 0, beforeDeliveryCount: 2 })).toBe(true);
    expect(stockWatchPrepareZdUsesHorizon({ lineCount: 1, beforeDeliveryCount: 2 })).toBe(false);
  });
});

describe("stockWatchSignalStale", () => {
  const now = Date.parse("2026-10-12T08:00:00Z");
  const hoursAgo = (h: number) => new Date(now - h * 3600 * 1000).toISOString();

  it("świeża analiza z nocy nie jest nieaktualna", () => {
    expect(stockWatchSignalStale(hoursAgo(6), now)).toBe(false);
  });

  it("granica 36 h: dokładnie 36 h jeszcze aktualne, później już nie", () => {
    expect(stockWatchSignalStale(hoursAgo(36), now)).toBe(false);
    expect(stockWatchSignalStale(hoursAgo(36.01), now)).toBe(true);
  });

  it("pusta albo błędna data = nieaktualne (nie twierdzimy, że stan wystarcza)", () => {
    expect(stockWatchSignalStale("", now)).toBe(true);
    expect(stockWatchSignalStale("nie-data", now)).toBe(true);
  });

  it("data z przyszłości (rozjazd zegarów) nie jest nieaktualna", () => {
    expect(stockWatchSignalStale(hoursAgo(-2), now)).toBe(false);
  });
});
