/** Normalizuje kh_Id z bazy (INTEGER) — odrzuca 0, NaN i puste stringi. */
export function parseSubiektKhId(raw: unknown): number | null {
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && raw.trim() !== ""
        ? Number(raw.trim())
        : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}
