import { describe, expect, it } from "vitest";
import {
  assertValidBomPolicy,
  isValidBomPolicyPair,
  policyFromBomPreset,
  presetFromBomPolicy,
  resolveBomPolicyFromInput,
  resolveBomStockAsCover,
} from "@/lib/orders/zd-estimate-bom-policy";

describe("zd-estimate-bom-policy", () => {
  it("maps presets to policy pairs", () => {
    expect(policyFromBomPreset("assemble")).toEqual({
      demandAllocation: "explode",
      purchaseTarget: "components",
    });
    expect(policyFromBomPreset("buy_separate")).toEqual({
      demandAllocation: "separate",
      purchaseTarget: "as_sold",
    });
    expect(policyFromBomPreset("kit_only")).toEqual({
      demandAllocation: "separate",
      purchaseTarget: "kit_only",
    });
  });

  it("rejects illegal pairs", () => {
    expect(isValidBomPolicyPair("explode", "as_sold")).toBe(false);
    expect(isValidBomPolicyPair("separate", "components")).toBe(false);
    expect(() => assertValidBomPolicy("explode", "kit_only")).toThrow();
  });

  it("forces stockAsCover off for separate", () => {
    expect(
      resolveBomStockAsCover({
        demandAllocation: "separate",
        stockAsCover: true,
      })
    ).toBe(false);
    expect(
      resolveBomStockAsCover({
        demandAllocation: "explode",
        stockAsCover: false,
      })
    ).toBe(false);
  });

  it("resolves from preset or fields", () => {
    expect(resolveBomPolicyFromInput({ preset: "buy_separate" })).toEqual({
      demandAllocation: "separate",
      purchaseTarget: "as_sold",
    });
    expect(
      presetFromBomPolicy("separate", "kit_only")
    ).toBe("kit_only");
  });
});
