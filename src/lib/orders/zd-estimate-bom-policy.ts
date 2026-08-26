/**
 * Presety kompletów/BOM — jedno źródło prawdy UI + server + silnik.
 */

export type BomDemandAllocation = "explode" | "separate";
export type BomPurchaseTarget =
  | "components"
  | "as_sold"
  | "kit_only"
  | "kit_from_components";

export type BomPresetId =
  | "assemble"
  | "buy_separate"
  | "kit_only"
  | "kit_from_components";

export type BomPolicyPair = {
  demandAllocation: BomDemandAllocation;
  purchaseTarget: BomPurchaseTarget;
};

export const BOM_PRESET_IDS: readonly BomPresetId[] = [
  "assemble",
  "buy_separate",
  "kit_only",
  "kit_from_components",
] as const;

export function policyFromBomPreset(preset: BomPresetId): BomPolicyPair {
  switch (preset) {
    case "buy_separate":
      return { demandAllocation: "separate", purchaseTarget: "as_sold" };
    case "kit_only":
      return { demandAllocation: "separate", purchaseTarget: "kit_only" };
    case "kit_from_components":
      return {
        demandAllocation: "separate",
        purchaseTarget: "kit_from_components",
      };
    case "assemble":
    default:
      return { demandAllocation: "explode", purchaseTarget: "components" };
  }
}

export function presetFromBomPolicy(
  allocation: BomDemandAllocation | string | null | undefined,
  target: BomPurchaseTarget | string | null | undefined
): BomPresetId {
  const a = normalizeDemandAllocation(allocation);
  const t = normalizePurchaseTarget(target);
  if (a === "separate" && t === "as_sold") return "buy_separate";
  if (a === "separate" && t === "kit_only") return "kit_only";
  if (a === "separate" && t === "kit_from_components") {
    return "kit_from_components";
  }
  return "assemble";
}

export function normalizeDemandAllocation(
  raw: unknown
): BomDemandAllocation {
  return raw === "separate" ? "separate" : "explode";
}

export function normalizePurchaseTarget(raw: unknown): BomPurchaseTarget {
  if (
    raw === "as_sold" ||
    raw === "kit_only" ||
    raw === "kit_from_components"
  ) {
    return raw;
  }
  return "components";
}

/** Składniki poza ZD — klasyczny kit_only albo rollup ze składników. */
export function purchaseTargetBlocksComponents(
  target: BomPurchaseTarget | string | null | undefined
): boolean {
  return target === "kit_only" || target === "kit_from_components";
}

export function isValidBomPolicyPair(
  allocation: BomDemandAllocation,
  target: BomPurchaseTarget
): boolean {
  if (allocation === "explode") return target === "components";
  return (
    target === "as_sold" ||
    target === "kit_only" ||
    target === "kit_from_components"
  );
}

export function assertValidBomPolicy(
  allocation: BomDemandAllocation,
  target: BomPurchaseTarget
): BomPolicyPair {
  if (!isValidBomPolicyPair(allocation, target)) {
    throw new Error(
      `Niedozwolona para polityki BOM: ${allocation} + ${target}.`
    );
  }
  return { demandAllocation: allocation, purchaseTarget: target };
}

/** Przy separate zawsze wyłącz cover; przy assemble zachowaj wybór (default true). */
export function resolveBomStockAsCover(input: {
  demandAllocation: BomDemandAllocation;
  stockAsCover?: boolean | null;
}): boolean {
  if (input.demandAllocation === "separate") return false;
  return input.stockAsCover !== false;
}

export function resolveBomPolicyFromInput(input: {
  preset?: BomPresetId | string | null;
  demandAllocation?: BomDemandAllocation | string | null;
  purchaseTarget?: BomPurchaseTarget | string | null;
}): BomPolicyPair {
  if (
    input.preset === "assemble" ||
    input.preset === "buy_separate" ||
    input.preset === "kit_only" ||
    input.preset === "kit_from_components"
  ) {
    return policyFromBomPreset(input.preset);
  }
  const allocation = normalizeDemandAllocation(input.demandAllocation);
  const target = normalizePurchaseTarget(input.purchaseTarget);
  return assertValidBomPolicy(allocation, target);
}
