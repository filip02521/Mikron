import { describe, expect, it } from "vitest";
import {
  ZD_CONTRACTOR_RECENT_MONTHS,
  zdContractorRecentDataOd,
  zdProductSearchDataOd,
} from "./zd-search-scope";

describe("zd-search-scope", () => {
  it("zdContractorRecentDataOd — 3 miesiące wstecz", () => {
    expect(ZD_CONTRACTOR_RECENT_MONTHS).toBe(3);
    expect(zdContractorRecentDataOd(new Date("2026-06-18T12:00:00+02:00"))).toBe(
      "2026-03-18"
    );
  });

  it("zdProductSearchDataOd — szerszy zakres bez kh_Id", () => {
    const od = zdProductSearchDataOd();
    const contractorOd = zdContractorRecentDataOd();
    expect(od < contractorOd).toBe(true);
  });
});
