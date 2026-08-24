import { describe, expect, it } from "vitest";
import { countZdEstimateTableColumns } from "./zd-estimate-table-virtual";

describe("countZdEstimateTableColumns", () => {
  it("bazowe kolumny bez opcjonalnych", () => {
    expect(
      countZdEstimateTableColumns({
        showPackagingColumn: false,
        visibleOptionalColumns: [],
      })
    ).toBe(6);
  });

  it("pack + stock (2) + sales", () => {
    expect(
      countZdEstimateTableColumns({
        showPackagingColumn: true,
        visibleOptionalColumns: ["stock", "sales"],
      })
    ).toBe(6 + 1 + 2 + 1);
  });

  it("pomija packaging w optional (już w showPackagingColumn)", () => {
    expect(
      countZdEstimateTableColumns({
        showPackagingColumn: true,
        visibleOptionalColumns: ["packaging", "zk"],
      })
    ).toBe(6 + 1 + 2);
  });
});
