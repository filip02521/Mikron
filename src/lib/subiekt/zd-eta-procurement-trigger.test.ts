import { describe, expect, it, vi } from "vitest";
import {
  collectZdEtaSyncSalesPersonIds,
  runZdEtaSyncForSalesPeople,
} from "./zd-eta-procurement-trigger";

const runZdEtaSyncForSalesPerson = vi.hoisted(() => vi.fn());

vi.mock("@/lib/subiekt/zd-eta-sync", () => ({
  runZdEtaSyncForSalesPerson,
}));

describe("collectZdEtaSyncSalesPersonIds", () => {
  it("zbiera unikalnych handlowców z zamówień (bez informacji)", () => {
    expect(
      collectZdEtaSyncSalesPersonIds([
        { sales_person_id: "sp1", request_kind: "zamowienie" },
        { sales_person_id: "sp1", request_kind: "zamowienie" },
        { sales_person_id: "sp2", request_kind: "zamowienie" },
        { sales_person_id: "sp3", request_kind: "informacja" },
      ])
    ).toEqual(["sp1", "sp2"]);
  });
});

describe("runZdEtaSyncForSalesPeople", () => {
  it("uruchamia sync per handlowiec z live search", async () => {
    runZdEtaSyncForSalesPerson.mockReset();
    runZdEtaSyncForSalesPerson
      .mockResolvedValueOnce({ skipped: false, updated: 1, processed: 2 })
      .mockResolvedValueOnce({ skipped: true, reason: "lock_held" });

    const result = await runZdEtaSyncForSalesPeople(["sp1", "sp1", "sp2"]);

    expect(result).toEqual({ updated: 1, processed: 2 });
    expect(runZdEtaSyncForSalesPerson).toHaveBeenCalledTimes(2);
    expect(runZdEtaSyncForSalesPerson).toHaveBeenCalledWith("sp1", {
      allowLiveSearch: true,
    });
    expect(runZdEtaSyncForSalesPerson).toHaveBeenCalledWith("sp2", {
      allowLiveSearch: true,
    });
  });
});
