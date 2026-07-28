import type { TeethKind, TeethLineDetail, TeethProductLine } from "@/lib/teeth/teeth-catalog";
import {
  classifyTeethShortageAvailability,
  teethShortageAvailabilityMessage,
} from "@/lib/teeth/teeth-shortage-copy";
import { warsawNowParts } from "@/lib/time/warsaw";

export type TeethShortageMatchInput = {
  id: string;
  supplierId: string;
  supplierName: string;
  productLine: string;
  color: string;
  mould: string;
  kind: TeethKind | null;
  availableFrom: string | null;
  note: string;
  active?: boolean;
};

export type TeethShortageMatchHit = {
  shortage: TeethShortageMatchInput;
  count: number;
  color: string;
  mould: string;
  kind: TeethKind | null;
  message: string;
};

function normToken(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function teethShortageVariantKey(input: {
  productLine: string;
  color: string;
  mould?: string | null;
  kind?: TeethKind | null;
}): string {
  return [
    input.productLine.trim(),
    normToken(input.color),
    normToken(input.mould),
    input.kind ?? "",
  ].join("|");
}

function detailMatchesShortage(
  detail: TeethLineDetail,
  productLine: TeethProductLine,
  shortage: TeethShortageMatchInput
): boolean {
  if (shortage.active === false) return false;
  if (shortage.productLine !== productLine) return false;
  if (normToken(detail.color) !== normToken(shortage.color)) return false;
  if (normToken(detail.mould) !== normToken(shortage.mould)) return false;
  if (shortage.kind != null && detail.kind !== shortage.kind) return false;
  return true;
}

/**
 * Dopasowuje aktywną listę braków do szczegółów zębów w prośbie.
 * Preferuje dostawcę z formularza, ale dokłada też hit innych labów na ten sam wariant.
 */
export function matchActiveTeethShortages(input: {
  details: TeethLineDetail[] | null | undefined;
  productLine: TeethProductLine | null | undefined;
  shortages: TeethShortageMatchInput[];
  supplierId?: string | null;
  todayKey?: string;
}): TeethShortageMatchHit[] {
  const productLine = input.productLine;
  const details = input.details ?? [];
  if (!productLine || details.length === 0) return [];

  const todayKey = input.todayKey ?? warsawNowParts().dateKey;
  const active = input.shortages.filter((s) => s.active !== false);
  const hits = new Map<string, TeethShortageMatchHit>();

  for (const detail of details) {
    const matched = active.filter((s) => detailMatchesShortage(detail, productLine, s));
    if (matched.length === 0) continue;

    const preferred = input.supplierId
      ? matched.filter((s) => s.supplierId === input.supplierId)
      : matched;
    const chosen = preferred.length > 0 ? preferred : matched;

    for (const shortage of chosen) {
      const key = `${shortage.id}`;
      const existing = hits.get(key);
      if (existing) {
        existing.count += 1;
        continue;
      }
      hits.set(key, {
        shortage,
        count: 1,
        color: shortage.color,
        mould: shortage.mould,
        kind: shortage.kind,
        message: teethShortageAvailabilityMessage(
          shortage.supplierName,
          shortage.availableFrom,
          todayKey
        ),
      });
    }
  }

  return Array.from(hits.values()).sort((a, b) => {
    const ak = classifyTeethShortageAvailability(a.shortage.availableFrom, todayKey);
    const bk = classifyTeethShortageAvailability(b.shortage.availableFrom, todayKey);
    const rank = (k: typeof ak) => (k === "undated" ? 0 : k === "past" ? 1 : 2);
    const rd = rank(ak) - rank(bk);
    if (rd !== 0) return rd;
    const ad = a.shortage.availableFrom ?? "";
    const bd = b.shortage.availableFrom ?? "";
    if (ad !== bd) return ad.localeCompare(bd);
    return a.shortage.supplierName.localeCompare(b.shortage.supplierName, "pl");
  });
}

export function formatTeethShortageHitLabel(hit: TeethShortageMatchHit): string {
  const parts = [`${hit.count}×`, hit.color.trim()];
  if (hit.mould.trim()) parts.push(hit.mould.trim());
  if (hit.kind === "anterior") parts.push("przody");
  if (hit.kind === "posterior") parts.push("boki");
  return parts.join(" ");
}
