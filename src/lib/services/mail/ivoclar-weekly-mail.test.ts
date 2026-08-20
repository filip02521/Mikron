import { describe, expect, it } from "vitest";
import {
  collectIvoclarIssues,
  computeIvoclarWeeklyPeriod,
  forcedIvoclarWeeklyPeriodKey,
  ivoclarWeeklyPeriodKeyForTrigger,
} from "@/lib/services/mail/ivoclar-weekly-mail";
import { buildIvoclarSelloutRow } from "@/lib/orders/ivoclar-report";
import { isWarsawScheduledMailWindow } from "@/lib/time/warsaw";

describe("computeIvoclarWeeklyPeriod", () => {
  it("zwraca ISO week key z poprzedniego tygodnia", () => {
    const period = computeIvoclarWeeklyPeriod("2026-08-18");
    expect(period.dataOd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(period.dataDo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(period.periodKey).toMatch(/^\d{4}-W\d{2}$/);
    expect(period.periodLabel).toContain(period.periodKey);
  });
});

describe("ivoclarWeeklyPeriodKeyForTrigger", () => {
  it("dodaje suffix :test dla trigger test", () => {
    const period = computeIvoclarWeeklyPeriod("2026-08-18");
    expect(ivoclarWeeklyPeriodKeyForTrigger(period, "test")).toBe(`${period.periodKey}:test`);
    expect(ivoclarWeeklyPeriodKeyForTrigger(period, "cron")).toBe(period.periodKey);
  });
});

describe("forcedIvoclarWeeklyPeriodKey", () => {
  it("tworzy osobny period_key dla manual force bez kolizji z produkcyjnym sent", () => {
    const period = computeIvoclarWeeklyPeriod("2026-08-18");
    const key = forcedIvoclarWeeklyPeriodKey(period, new Date("2026-08-19T11:12:13.000Z"));
    expect(key).toBe(`${period.periodKey}:manual-force:2026-08-19T11:12:13.000Z`);
  });
});

describe("collectIvoclarIssues", () => {
  it("klasyfikuje blocking gaps vs warning", () => {
    const rowMissing = buildIvoclarSelloutRow({
      dokId: 1,
      dokNr: "FS/1",
      dokDataWyst: "2026-08-10",
      khId: 1,
      khName: "Test",
      twId: 1,
      twSymbol: "12345",
      twNazwa: "Towar",
      quantity: 1,
      postalRaw: "",
      city: "Warszawa",
    });
    const issues = collectIvoclarIssues({
      selloutRows: [rowMissing],
      fetchErrors: [],
      selloutSkippedCount: 1,
      inventorySkippedCount: 0,
    });
    expect(issues.some((i) => i.code === "missing_postal" && i.severity === "blocking")).toBe(
      true
    );
    expect(issues.some((i) => i.code === "sellout_rows_skipped")).toBe(true);
  });
});

describe("isWarsawScheduledMailWindow", () => {
  it("poniedziałek 7–9 Warszawa (CEST)", () => {
    expect(isWarsawScheduledMailWindow(new Date("2026-08-17T05:30:00Z"))).toBe(true);
    expect(isWarsawScheduledMailWindow(new Date("2026-08-17T07:30:00Z"))).toBe(true);
    expect(isWarsawScheduledMailWindow(new Date("2026-08-17T10:30:00Z"))).toBe(false);
  });

  it("wtorek — poza oknem", () => {
    expect(isWarsawScheduledMailWindow(new Date("2026-08-18T06:00:00Z"))).toBe(false);
  });
});
