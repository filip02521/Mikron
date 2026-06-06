import type { ProsbaLineFieldMap } from "@/lib/orders/prosba-line-field-validation";

export type ProductLineFieldVisualProps = {
  state?: "default" | "warning" | "error" | "success";
  error?: string;
  hint?: string;
};

function fieldProps(
  key: keyof ProsbaLineFieldMap,
  validation?: ProsbaLineFieldMap
): ProductLineFieldVisualProps {
  const v = validation?.[key];
  if (!v || v.state === "default") return {};
  const sharedProductMessage =
    v.message?.includes("nazwę lub symbol") ||
    v.message?.includes("symbol, kod Mikran");
  if (sharedProductMessage && key !== "product") {
    return { state: v.state };
  }
  return { state: v.state, error: v.message };
}

/** Scalone pole produktu — najwyższy stan z symbol + product. */
export function mergeCombinedProductFieldProps(
  validation?: ProsbaLineFieldMap
): ProductLineFieldVisualProps {
  const rank = { default: 0, success: 1, warning: 2, error: 3 } as const;
  let state: "default" | "warning" | "error" | "success" = "default";
  for (const key of ["symbol", "product"] as const) {
    const s = validation?.[key]?.state ?? "default";
    if (rank[s] > rank[state]) state = s;
  }
  const message =
    validation?.product?.message ?? validation?.symbol?.message;
  if (state === "default" && !message) return {};
  if (message) return { state, error: message };
  return { state };
}

export function mikranFieldProps(
  validation?: ProsbaLineFieldMap
): ProductLineFieldVisualProps {
  return fieldProps("mikranCode", validation);
}

export function quantityFieldProps(
  validation?: ProsbaLineFieldMap
): ProductLineFieldVisualProps {
  return fieldProps("quantity", validation);
}
