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

  it("pack + cover + sales + value", () => {
    expect(
      countZdEstimateTableColumns({
        showPackagingColumn: true,
        visibleOptionalColumns: ["cover", "sales", "value"],
      })
    ).toBe(6 + 1 + 3);
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
