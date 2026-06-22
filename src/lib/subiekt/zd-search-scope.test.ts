import { describe, expect, it } from "vitest";
import {
  ZD_CONTRACTOR_EXTENDED_MONTHS,
  ZD_CONTRACTOR_INITIAL_DAYS,
  ZD_CONTRACTOR_RECENT_MONTHS,
  ZD_PLACEMENT_BROWSE_MONTHS_AFTER,
  ZD_PLACEMENT_BROWSE_MONTHS_BEFORE,
  buildZdSearchPlacements,
  placementIsOlderThanRollingWindow,
  sortMonthChunksNearPlacement,
  zdContractorExtendedDataOd,
  zdContractorExtendedDataOdForPlacement,
  zdContractorInitialDataOd,
  zdContractorInitialDataOdForPlacement,
  zdContractorRecentDataOd,
  zdDataDoFromPlacement,
  zdDataOdFromPlacement,
  zdMergedPlacementBrowseMonthChunks,
  zdPlacementBrowseMonthChunks,
  zdPlacementIssueDateInBrowseWindow,
  zdPlacementListWindowForApi,
  zdProductSearchDataOd,
} from "./zd-search-scope";

describe("zd-search-scope", () => {
  it("zdContractorInitialDataOd — 30 dni wstecz", () => {
    expect(ZD_CONTRACTOR_INITIAL_DAYS).toBe(30);
    expect(zdContractorInitialDataOd(new Date("2026-06-18T12:00:00+02:00"))).toBe(
      "2026-05-19"
    );
  });

  it("zdContractorExtendedDataOd — 3 miesiące wstecz", () => {
    expect(ZD_CONTRACTOR_EXTENDED_MONTHS).toBe(3);
    expect(ZD_CONTRACTOR_RECENT_MONTHS).toBe(3);
    expect(zdContractorExtendedDataOd(new Date("2026-06-18T12:00:00+02:00"))).toBe(
      "2026-03-18"
    );
    expect(zdContractorRecentDataOd(new Date("2026-06-18T12:00:00+02:00"))).toBe(
      "2026-03-18"
    );
  });

  it("zdProductSearchDataOd — szerszy zakres bez kh_Id", () => {
    const od = zdProductSearchDataOd();
    const contractorOd = zdContractorExtendedDataOd();
    expect(od < contractorOd).toBe(true);
  });

  it("zgłoszenie starsze niż rolling 3m — dataOd sięga okresu zamówienia (np. luty)", () => {
    const syncAt = new Date("2026-06-18T12:00:00+02:00");
    const februaryPlacement = "2026-02-10";
    const rolling = zdContractorExtendedDataOd(syncAt);
    const fromPlacement = zdContractorExtendedDataOdForPlacement(februaryPlacement, syncAt);
    expect(rolling).toBe("2026-03-18");
    expect(fromPlacement).toBe(zdDataOdFromPlacement(februaryPlacement, syncAt));
    expect(fromPlacement < rolling).toBe(true);
    expect(fromPlacement).toBe("2026-01-27");
  });

  it("placementAt poszerza też pierwszą fazę (30d)", () => {
    const syncAt = new Date("2026-06-18T12:00:00+02:00");
    const februaryPlacement = "2026-02-10";
    const rolling = zdContractorInitialDataOd(syncAt);
    const fromPlacement = zdContractorInitialDataOdForPlacement(februaryPlacement, syncAt);
    expect(rolling).toBe("2026-05-19");
    expect(fromPlacement < rolling).toBe(true);
  });

  it("zdDataDoFromPlacement — okno po zamówieniu", () => {
    expect(zdDataDoFromPlacement("2026-02-10")).toBe("2026-06-10");
  });

  it("stare zgłoszenie — okna miesięczne wokół lutego (miesiąc wstecz + 2 naprzód)", () => {
    const syncAt = new Date("2026-06-18T12:00:00+02:00");
    const placement = "2026-02-10";
    expect(placementIsOlderThanRollingWindow(placement, syncAt)).toBe(true);
    expect(ZD_PLACEMENT_BROWSE_MONTHS_BEFORE).toBe(1);
    expect(ZD_PLACEMENT_BROWSE_MONTHS_AFTER).toBe(2);

    const chunks = zdPlacementBrowseMonthChunks(placement, syncAt);
    expect(chunks).toEqual([
      { dataOd: "2026-01-01", dataDo: "2026-02-01" },
      { dataOd: "2026-02-01", dataDo: "2026-03-01" },
      { dataOd: "2026-03-01", dataDo: "2026-04-01" },
      { dataOd: "2026-04-01", dataDo: "2026-05-01" },
    ]);

    const ordered = sortMonthChunksNearPlacement(chunks, placement);
    expect(ordered[0]).toEqual({ dataOd: "2026-02-01", dataDo: "2026-03-01" });

    expect(zdPlacementIssueDateInBrowseWindow("2026-02-09", placement, syncAt)).toBe(true);
    expect(zdPlacementIssueDateInBrowseWindow("2026-06-03", placement, syncAt)).toBe(false);

    const apiWindow = zdPlacementListWindowForApi(placement, syncAt);
    expect(apiWindow).toEqual({ dataOd: "2026-01-01", dataDo: "2026-05-01" });
  });

  it("świeże zgłoszenie — ostatnie 3 miesiące kalendarzowe", () => {
    const syncAt = new Date("2026-06-18T12:00:00+02:00");
    const placement = "2026-06-10";
    expect(placementIsOlderThanRollingWindow(placement, syncAt)).toBe(false);
    const chunks = zdPlacementBrowseMonthChunks(placement, syncAt);
    expect(chunks).toEqual([
      { dataOd: "2026-04-01", dataDo: "2026-05-01" },
      { dataOd: "2026-05-01", dataDo: "2026-06-01" },
      { dataOd: "2026-06-01", dataDo: "2026-07-01" },
    ]);
  });

  it("buildZdSearchPlacements — prośba + historia dostawcy, bez duplikatów", () => {
    const syncAt = new Date("2026-06-18T12:00:00+02:00");
    expect(
      buildZdSearchPlacements("2026-05-12", ["2026-04-14", "2026-05-26", "2026-03-10"], syncAt)
    ).toEqual(["2026-05-12", "2026-05-26", "2026-04-14", "2026-03-10"]);
  });

  it("zdMergedPlacementBrowseMonthChunks — łączy okna prośby i zamówień głównych", () => {
    const syncAt = new Date("2026-06-18T12:00:00+02:00");
    const merged = zdMergedPlacementBrowseMonthChunks(
      ["2026-05-12", "2026-04-14"],
      "2026-05-12",
      syncAt
    );
    expect(merged.some((chunk) => chunk.dataOd === "2026-04-01")).toBe(true);
    expect(merged.some((chunk) => chunk.dataOd === "2026-05-01")).toBe(true);
    expect(merged[0]).toEqual({ dataOd: "2026-05-01", dataDo: "2026-06-01" });
  });

  it("zdMergedPlacementBrowseMonthChunks — bez daty zaczyna od bieżącego miesiąca", () => {
    const syncAt = new Date("2026-06-18T12:00:00+02:00");
    expect(zdMergedPlacementBrowseMonthChunks([], null, syncAt)[0]).toEqual({
      dataOd: "2026-06-01",
      dataDo: "2026-07-01",
    });
  });
});
