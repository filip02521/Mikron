/**
 * Jak rezerwa próśb wchodzi w Do ZD względem niedoboru stock.
 * Shared (`app_settings`) — nie per-user, żeby Create był spójny w dziale.
 *
 * `sum` (domyślnie): need + extra — rezerwa „na wierzchu”.
 * `max`: max(need, extra) — gdy prośba już pokrywa niedobór.
 */

export const ZD_ESTIMATE_EXTRAS_POLICY_SETTING_KEY =
  "zd_estimate_extras_policy";

export const ZD_ESTIMATE_EXTRAS_POLICIES = ["sum", "max"] as const;

export type ZdEstimateExtrasPolicy =
  (typeof ZD_ESTIMATE_EXTRAS_POLICIES)[number];

export const ZD_ESTIMATE_EXTRAS_POLICY_DEFAULT: ZdEstimateExtrasPolicy = "sum";

export function parseZdEstimateExtrasPolicy(
  raw: unknown
): ZdEstimateExtrasPolicy {
  if (raw === "max" || raw === "sum") return raw;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const policy = (raw as { policy?: unknown }).policy;
    if (policy === "max" || policy === "sum") return policy;
  }
  return ZD_ESTIMATE_EXTRAS_POLICY_DEFAULT;
}

export function serializeZdEstimateExtrasPolicy(
  policy: ZdEstimateExtrasPolicy
): { policy: ZdEstimateExtrasPolicy } {
  return { policy: parseZdEstimateExtrasPolicy(policy) };
}

export function combineStockNeedWithExtra(
  stockNeed: number,
  extraPieces: number,
  policy: ZdEstimateExtrasPolicy = ZD_ESTIMATE_EXTRAS_POLICY_DEFAULT
): number {
  const stock = Math.max(0, Math.ceil(Number(stockNeed) || 0));
  const extra = Math.max(0, Math.ceil(Number(extraPieces) || 0));
  if (extra <= 0) return stock;
  if (stock <= 0) return extra;
  return policy === "max" ? Math.max(stock, extra) : stock + extra;
}
