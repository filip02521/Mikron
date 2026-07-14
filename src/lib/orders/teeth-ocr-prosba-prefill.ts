import { randomId } from "@/lib/ensure-crypto";
import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import type {
  TeethManufacturer,
  TeethProductLine,
  TeethKind,
} from "@/lib/teeth/teeth-catalog";
import { expandTeethGroups, totalTeethCountFromGroups, TEETH_KIND_LABELS } from "@/lib/teeth/teeth-catalog";
import { teethProductLineLabel } from "@/lib/teeth/teeth-catalog";
import type { TeethOcrGroup } from "@/components/teeth/TeethOcrWizard";

export const TEETH_OCR_PROSBA_PREFILL_STORAGE_KEY = "ontime-prosba-teeth-ocr-prefill";

export type TeethOcrProsbaPrefill = {
  lines: ProductLineDraft[];
  imagePath: string | null;
};

/**
 * Convert OCR groups into ProductLineDraft[] for /prosba.
 * Groups are split by (productLine, kind) so anterior and posterior
 * from the same product line become separate entries.
 */
export function buildTeethOcrProsbaLines(
  groups: TeethOcrGroup[],
  imagePath: string | null,
): ProductLineDraft[] {
  type LineKey = `${TeethProductLine}|${TeethKind}`;
  const byKey = new Map<LineKey, TeethOcrGroup[]>();

  for (const g of groups) {
    const kind = g.kind;
    if (!kind) continue;
    const key: LineKey = `${g.productLine}|${kind}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.push(g);
    } else {
      byKey.set(key, [g]);
    }
  }

  const lines: ProductLineDraft[] = [];

  for (const [key, lineGroups] of byKey) {
    const [productLine, kind] = key.split("|") as [TeethProductLine, TeethKind];
    const details = expandTeethGroups(lineGroups);
    const totalQty = totalTeethCountFromGroups(lineGroups);

    const lineLabel = teethProductLineLabel(productLine) ?? productLine;
    const kindLabel = TEETH_KIND_LABELS[kind];
    const product = `${lineLabel} — ${kindLabel}`;

    lines.push({
      id: randomId(),
      symbol: "",
      mikranCode: "",
      product,
      quantity: String(totalQty),
      teethManufacturer: inferManufacturer(productLine),
      teethProductLine: productLine,
      teethKind: kind,
      teethDetails: details,
      teethOcrPending: true,
      teethOcrImagePath: imagePath,
    });
  }

  return lines;
}

function inferManufacturer(productLine: TeethProductLine): TeethManufacturer | null {
  const prefix = productLine.split("_")[0];
  switch (prefix) {
    case "wiedent":
      return "wiedent";
    case "ivoclar":
      return "ivoclar";
    case "major":
      return "major";
    case "dentex":
      return "dentex";
    case "schottlander":
      return "schottlander";
    case "hansen":
      return "hansen";
    case "mgm":
      return "mgm";
    case "formed":
      return "formed";
    default:
      return null;
  }
}

export function saveTeethOcrProsbaPrefill(
  groups: TeethOcrGroup[],
  imagePath: string | null,
): void {
  if (typeof sessionStorage === "undefined") return;
  const lines = buildTeethOcrProsbaLines(groups, imagePath);
  if (!lines.length) return;
  const prefill: TeethOcrProsbaPrefill = { lines, imagePath };
  sessionStorage.setItem(TEETH_OCR_PROSBA_PREFILL_STORAGE_KEY, JSON.stringify(prefill));
}

export function readTeethOcrProsbaPrefill(): TeethOcrProsbaPrefill | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(TEETH_OCR_PROSBA_PREFILL_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<TeethOcrProsbaPrefill>;
    if (!parsed?.lines?.length) return null;
    return {
      lines: parsed.lines.map((line) => ({
        ...line,
        id: randomId(),
        subiektTwId:
          line.subiektTwId != null && Number.isFinite(Number(line.subiektTwId))
            ? Math.trunc(Number(line.subiektTwId))
            : undefined,
      })),
      imagePath: parsed.imagePath ?? null,
    };
  } catch {
    return null;
  }
}

export function clearTeethOcrProsbaPrefill(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(TEETH_OCR_PROSBA_PREFILL_STORAGE_KEY);
}
