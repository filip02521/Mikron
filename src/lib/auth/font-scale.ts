export type FontScale = "default" | "large" | "xlarge";

export const FONT_SCALE_LABELS: Record<FontScale, string> = {
  default: "Standardowa",
  large: "Większa",
  xlarge: "Największa",
};

export function normalizeFontScale(value: unknown): FontScale {
  if (value === "large" || value === "xlarge") return value;
  return "default";
}
