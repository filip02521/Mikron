import type { ExternalWarehousePrunedLine } from "@/lib/external-warehouse/lines";

export type LineRematchCandidate = Pick<
  ExternalWarehousePrunedLine,
  "key" | "ob_TowId" | "tw_Symbol" | "tw_Nazwa"
>;

/**
 * Odcisk towaru do rematchu kluczy po syncu Subiekta.
 * Preferuje ob_TowId, potem symbol, potem nazwę — bez idx (niestabilne).
 */
export function fingerprintForLineRematch(
  line: LineRematchCandidate
): string | null {
  if (line.ob_TowId != null && Number.isFinite(line.ob_TowId)) {
    return `tow:${Math.trunc(line.ob_TowId)}`;
  }
  const sym = (line.tw_Symbol ?? "").trim().toLowerCase();
  if (sym) return `sym:${sym}`;
  const name = (line.tw_Nazwa ?? "").trim().toLowerCase();
  if (name) return `name:${name}`;
  return null;
}

function uniqueFingerprintMap(
  lines: LineRematchCandidate[]
): Map<string, string> {
  const counts = new Map<string, number>();
  const firstKey = new Map<string, string>();
  for (const line of lines) {
    const fp = fingerprintForLineRematch(line);
    if (!fp) continue;
    counts.set(fp, (counts.get(fp) ?? 0) + 1);
    if (!firstKey.has(fp)) firstKey.set(fp, line.key);
  }
  const unique = new Map<string, string>();
  for (const [fp, count] of counts) {
    if (count === 1) {
      const key = firstKey.get(fp);
      if (key) unique.set(fp, key);
    }
  }
  return unique;
}

/**
 * Plan 1:1 przeniesienia meta/udziałów gdy Subiekt zmieni ob_Id (nowy line_key),
 * ale towar jest ten sam. Tylko unikalne fingerprinty po obu stronach.
 */
export function planLineKeyRematches(
  removed: LineRematchCandidate[],
  added: LineRematchCandidate[]
): { fromKey: string; toKey: string }[] {
  if (!removed.length || !added.length) return [];
  const fromByFp = uniqueFingerprintMap(removed);
  const toByFp = uniqueFingerprintMap(added);
  const out: { fromKey: string; toKey: string }[] = [];
  const usedTo = new Set<string>();

  for (const [fp, fromKey] of fromByFp) {
    const toKey = toByFp.get(fp);
    if (!toKey || toKey === fromKey || usedTo.has(toKey)) continue;
    usedTo.add(toKey);
    out.push({ fromKey, toKey });
  }
  return out;
}
