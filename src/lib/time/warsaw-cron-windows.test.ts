import { describe, expect, it } from "vitest";
import { isWarsawCatalogSyncWindow } from "@/lib/subiekt/catalog-zd-sync";
import {
  isWarsawBusinessDay,
  isWarsawMorningRoutineHour,
  isWarsawWorkHours,
} from "@/lib/time/warsaw";

describe("cron time windows (Europe/Warsaw)", () => {
  it("poranna rutyna tylko o 6:00 w dni robocze", () => {
    expect(isWarsawMorningRoutineHour(new Date("2026-06-18T04:00:00Z"))).toBe(true);
    expect(isWarsawMorningRoutineHour(new Date("2026-06-18T05:00:00Z"))).toBe(false);
    expect(isWarsawMorningRoutineHour(new Date("2026-06-20T04:00:00Z"))).toBe(false);
  });

  it("godziny pracy 8–18 pn–pt", () => {
    expect(isWarsawWorkHours(new Date("2026-06-18T06:00:00Z"))).toBe(true);
    expect(isWarsawWorkHours(new Date("2026-06-18T16:00:00Z"))).toBe(true);
    expect(isWarsawWorkHours(new Date("2026-06-18T05:00:00Z"))).toBe(false);
    expect(isWarsawWorkHours(new Date("2026-06-18T17:00:00Z"))).toBe(false);
  });

  it("nocny catalog sync 1:00–4:59", () => {
    expect(isWarsawCatalogSyncWindow(new Date("2026-06-18T00:30:00Z"))).toBe(true);
    expect(isWarsawCatalogSyncWindow(new Date("2026-06-18T01:00:00Z"))).toBe(true);
    expect(isWarsawCatalogSyncWindow(new Date("2026-06-18T03:00:00Z"))).toBe(false);
    expect(isWarsawCatalogSyncWindow(new Date("2026-06-18T05:00:00Z"))).toBe(false);
  });

  it("dni robocze pn–pt", () => {
    expect(isWarsawBusinessDay(new Date("2026-06-18T12:00:00Z"))).toBe(true);
    expect(isWarsawBusinessDay(new Date("2026-06-20T12:00:00Z"))).toBe(false);
  });
});
