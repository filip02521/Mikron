import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import { newProductLine } from "@/components/orders/request-product-lines";
import { MAX_BATCH_ORDER_LINES } from "@/lib/security/text-limits";
import {
  expandTeethGroups,
  detectTeethKind,
  detectTeethProductLine,
  manufacturerForProductLine,
  teethGroupsFromDetails,
  type TeethGroupDraft,
  type TeethKind,
  type TeethLineDetail,
  type TeethManufacturer,
  type TeethProductLine,
} from "@/lib/teeth/teeth-catalog";
import { catalogLineSupportsDualKind } from "@/lib/teeth/teeth-lines-data";
import {
  catalogLineForDualKind,
  isCrossLineDualKindPair,
  TEETH_CROSS_LINE_DUAL_KIND_PAIRS,
} from "@/lib/teeth/teeth-cross-line-pairs";
import {
  TEETH_DUAL_EMPTY_SECTIONS,
  TEETH_DUAL_LINE_LIMIT_MESSAGE,
  teethDualMissingRegistryProductMessage,
} from "@/lib/teeth/teeth-builder-copy";

export type TeethRegistryProduct = {
  twId: number;
  symbol: string | null;
  name: string;
  plu: string | null;
  manufacturer: TeethManufacturer | null;
  productLine: TeethProductLine;
  kind: TeethKind;
};

export type TeethRegistryEntry = {
  twId: number;
  manufacturer: TeethManufacturer | null;
  productLine: TeethProductLine | null;
  kind: TeethKind | null;
  symbol?: string | null;
  name?: string | null;
  plu?: string | null;
};

export type TeethRegistryIndex = {
  byLineAndKind: Map<string, TeethRegistryProduct>;
};

export type TeethDualKindCommitSummary = {
  added: Array<{ kind: TeethKind; product: string; quantity: number }>;
  updated: Array<{ kind: TeethKind; product: string; quantity: number }>;
  removed: TeethKind[];
};

export type TeethDualKindCommitResult =
  | {
      ok: true;
      lines: ProductLineDraft[];
      summary: TeethDualKindCommitSummary;
      focusLineId: string | null;
    }
  | { ok: false; error: string };

function lineKindKey(productLine: TeethProductLine, kind: TeethKind): string {
  return `${productLine}:${kind}`;
}

export {
  catalogLineForDualKind,
  isCrossLineDualKindPair,
  TEETH_CROSS_LINE_DUAL_KIND_PAIRS as CROSS_LINE_DUAL_KIND_PAIRS,
} from "@/lib/teeth/teeth-cross-line-pairs";

/** Uzupełnia brakujące product_line / kind z nazwy towaru (legacy admin, ogólne nazwy Subiekta). */
export function enrichTeethRegistryEntry(entry: TeethRegistryEntry): TeethRegistryEntry | null {
  const twId = Math.trunc(entry.twId);
  if (twId <= 0) return null;

  const name = entry.name?.trim() ?? "";
  let manufacturer = entry.manufacturer;
  let productLine = entry.productLine;
  let kind = entry.kind;

  if (!productLine && name) {
    productLine = detectTeethProductLine(name, { manufacturer });
  } else if (name) {
    const fromName = detectTeethProductLine(name, { manufacturer });
    if (
      fromName === "wiedent_estetic_vita" &&
      productLine === "wiedent_estetic"
    ) {
      productLine = fromName;
    }
  }
  if (productLine && !manufacturer) {
    manufacturer = manufacturerForProductLine(productLine);
  }
  if (!kind && name) {
    kind = detectTeethKind(name);
  }

  if (!productLine || !kind) return null;

  return {
    ...entry,
    twId,
    manufacturer,
    productLine,
    kind,
    name: name || entry.name,
  };
}

export function buildTeethRegistryIndex(entries: TeethRegistryEntry[]): TeethRegistryIndex {
  const byLineAndKind = new Map<string, TeethRegistryProduct>();
  for (const raw of entries) {
    const entry = enrichTeethRegistryEntry(raw);
    if (!entry?.productLine || !entry.kind) continue;
    const twId = Math.trunc(entry.twId);
    if (twId <= 0) continue;
    byLineAndKind.set(lineKindKey(entry.productLine, entry.kind), {
      twId,
      symbol: entry.symbol ?? null,
      name: entry.name?.trim() || `Towar ${twId}`,
      plu: entry.plu ?? null,
      manufacturer:
        entry.manufacturer ?? manufacturerForProductLine(entry.productLine),
      productLine: entry.productLine,
      kind: entry.kind,
    });
  }
  return { byLineAndKind };
}

export function supportsDualKindBuilder(
  index: TeethRegistryIndex,
  productLine: TeethProductLine,
): boolean {
  const hasAnterior = index.byLineAndKind.has(lineKindKey(productLine, "anterior"));
  const hasPosterior = index.byLineAndKind.has(lineKindKey(productLine, "posterior"));
  if (hasAnterior && hasPosterior) return true;

  for (const [anteriorLine, posteriorLine] of TEETH_CROSS_LINE_DUAL_KIND_PAIRS) {
    if (productLine !== anteriorLine && productLine !== posteriorLine) continue;
    const hasAnterior = index.byLineAndKind.has(lineKindKey(anteriorLine, "anterior"));
    const hasPosterior = index.byLineAndKind.has(lineKindKey(posteriorLine, "posterior"));
    if (hasAnterior && hasPosterior) return true;
  }

  // Katalog z przodami i bokami (np. Phonares) — UI dual nawet gdy w adminie brakuje pary.
  return catalogLineSupportsDualKind(productLine);
}

export function resolveTeethCatalogProduct(
  index: TeethRegistryIndex,
  productLine: TeethProductLine,
  kind: TeethKind,
): TeethRegistryProduct | null {
  for (const [anteriorLine, posteriorLine] of TEETH_CROSS_LINE_DUAL_KIND_PAIRS) {
    if (productLine === anteriorLine && kind === "posterior") {
      return index.byLineAndKind.get(lineKindKey(posteriorLine, "posterior")) ?? null;
    }
    if (productLine === posteriorLine && kind === "anterior") {
      return index.byLineAndKind.get(lineKindKey(anteriorLine, "anterior")) ?? null;
    }
  }
  return index.byLineAndKind.get(lineKindKey(productLine, kind)) ?? null;
}

export function partitionTeethDetailsByKind(
  details: TeethLineDetail[] | undefined,
): {
  anterior: TeethLineDetail[];
  posterior: TeethLineDetail[];
} {
  const anterior: TeethLineDetail[] = [];
  const posterior: TeethLineDetail[] = [];
  if (!details?.length) return { anterior, posterior };
  for (const detail of details) {
    if (detail.kind === "posterior") posterior.push(detail);
    else anterior.push(detail);
  }
  return { anterior, posterior };
}

export function teethGroupsForKind(
  details: TeethLineDetail[] | undefined,
  kind: TeethKind,
): TeethGroupDraft[] {
  if (!details?.length) return [];
  const filtered = details.filter((d) => (d.kind ?? "anterior") === kind);
  if (filtered.length === 0) return [];
  return teethGroupsFromDetails(
    filtered.map((d, i) => ({ ...d, position: i + 1, kind })),
  );
}

function expandGroupsWithKind(
  groups: TeethGroupDraft[],
  kind: TeethKind,
): TeethLineDetail[] {
  const normalized = groups.map((g) => ({ ...g, kind }));
  return expandTeethGroups(normalized).map((d) => ({ ...d, kind }));
}

function isPairedTeethLine(line: ProductLineDraft, anchor: ProductLineDraft): boolean {
  const anchorLine = anchor.teethProductLine;
  const lineLine = line.teethProductLine;
  if (!anchorLine || !lineLine) return false;
  const anchorKind = anchor.teethKind;
  if (anchorKind !== "anterior" && anchorKind !== "posterior") return false;
  const oppositeKind: TeethKind = anchorKind === "anterior" ? "posterior" : "anterior";
  if (line.teethKind !== oppositeKind) return false;
  if ((line.clientName ?? "") !== (anchor.clientName ?? "")) return false;
  if (anchorLine === lineLine) return true;
  return isCrossLineDualKindPair(anchorLine, lineLine);
}

function pairedLineInsertIndex(
  lines: ProductLineDraft[],
  pairedIndices: number[],
  anchorIndex: number,
): number {
  const pairedSet = new Set(pairedIndices);
  return lines.slice(0, anchorIndex).filter((_, i) => !pairedSet.has(i)).length;
}

function buildTeethLineFromRegistry(
  template: ProductLineDraft,
  product: TeethRegistryProduct,
  details: TeethLineDetail[],
  lineId: string,
  fromOcr?: boolean,
  ocrImagePath?: string | null,
): ProductLineDraft {
  return {
    ...template,
    id: lineId,
    symbol: product.symbol?.trim() || template.symbol,
    product: product.name,
    mikranCode: product.plu?.trim() || template.mikranCode,
    subiektTwId: product.twId,
    teethManufacturer: product.manufacturer,
    teethProductLine: product.productLine,
    teethKind: product.kind,
    teethDetails: details,
    teethOcrPending: fromOcr ?? false,
    teethOcrImagePath: ocrImagePath ?? null,
    quantity: String(details.length),
  };
}

function lineExistedWithQuantity(
  lines: ProductLineDraft[],
  anchorLine: TeethProductLine,
  kind: TeethKind,
  clientName: string | undefined,
): { existed: boolean; quantity: number; product: string } {
  const catalogLine = catalogLineForDualKind(anchorLine, kind);
  const match = lines.find(
    (line) =>
      line.teethProductLine === catalogLine
      && line.teethKind === kind
      && (line.clientName ?? "") === (clientName ?? ""),
  );
  if (!match) return { existed: false, quantity: 0, product: "" };
  const rawQty = match.teethDetails?.length ?? parseInt(match.quantity, 10);
  const qty = Number.isFinite(rawQty) ? rawQty : 0;
  return { existed: true, quantity: qty, product: match.product };
}

export function commitDualKindTeethLines(
  lines: ProductLineDraft[],
  anchorIndex: number,
  anteriorGroups: TeethGroupDraft[],
  posteriorGroups: TeethGroupDraft[],
  index: TeethRegistryIndex,
  fromOcr?: boolean,
  ocrImagePath?: string | null,
): TeethDualKindCommitResult {
  const anchor = lines[anchorIndex];
  if (!anchor?.teethProductLine) {
    return { ok: false, error: "Brak linii produktowej dla pozycji zębowej." };
  }

  const productLine = anchor.teethProductLine;
  const anteriorDetails = expandGroupsWithKind(anteriorGroups, "anterior");
  const posteriorDetails = expandGroupsWithKind(posteriorGroups, "posterior");

  if (anteriorDetails.length === 0 && posteriorDetails.length === 0) {
    return { ok: false, error: TEETH_DUAL_EMPTY_SECTIONS };
  }

  const anteriorProduct =
    anteriorDetails.length > 0
      ? resolveTeethCatalogProduct(index, productLine, "anterior")
      : null;
  const posteriorProduct =
    posteriorDetails.length > 0
      ? resolveTeethCatalogProduct(index, productLine, "posterior")
      : null;

  if (anteriorDetails.length > 0 && !anteriorProduct) {
    return {
      ok: false,
      error: teethDualMissingRegistryProductMessage("anterior", productLine),
    };
  }
  if (posteriorDetails.length > 0 && !posteriorProduct) {
    return {
      ok: false,
      error: teethDualMissingRegistryProductMessage("posterior", productLine),
    };
  }

  const pairedIndices = lines
    .map((line, i) => (i === anchorIndex || isPairedTeethLine(line, anchor) ? i : -1))
    .filter((i) => i >= 0);

  const preservedIds = new Map<TeethKind, string>();
  for (const i of pairedIndices) {
    const kind = lines[i]?.teethKind;
    if (kind === "anterior" || kind === "posterior") {
      preservedIds.set(kind, lines[i]!.id);
    }
  }
  if (!preservedIds.has("anterior") && anchor.teethKind === "anterior") {
    preservedIds.set("anterior", anchor.id);
  }
  if (!preservedIds.has("posterior") && anchor.teethKind === "posterior") {
    preservedIds.set("posterior", anchor.id);
  }

  const beforeAnterior = lineExistedWithQuantity(
    lines,
    productLine,
    "anterior",
    anchor.clientName,
  );
  const beforePosterior = lineExistedWithQuantity(
    lines,
    productLine,
    "posterior",
    anchor.clientName,
  );

  const newSegments: ProductLineDraft[] = [];
  if (anteriorDetails.length > 0 && anteriorProduct) {
    newSegments.push(
      buildTeethLineFromRegistry(
        anchor,
        anteriorProduct,
        anteriorDetails,
        preservedIds.get("anterior") ?? newProductLine().id,
        fromOcr,
        ocrImagePath,
      ),
    );
  }
  if (posteriorDetails.length > 0 && posteriorProduct) {
    newSegments.push(
      buildTeethLineFromRegistry(
        anchor,
        posteriorProduct,
        posteriorDetails,
        preservedIds.get("posterior") ?? newProductLine().id,
        fromOcr,
        ocrImagePath,
      ),
    );
  }

  const removedCount = pairedIndices.length;
  const newTotal = lines.length - removedCount + newSegments.length;
  if (newTotal > MAX_BATCH_ORDER_LINES) {
    return { ok: false, error: TEETH_DUAL_LINE_LIMIT_MESSAGE };
  }

  const filtered = lines.filter((_, i) => !pairedIndices.includes(i));
  const insertAt = pairedLineInsertIndex(lines, pairedIndices, anchorIndex);
  const resultLines = [
    ...filtered.slice(0, insertAt),
    ...newSegments,
    ...filtered.slice(insertAt),
  ];

  const summary: TeethDualKindCommitSummary = {
    added: [],
    updated: [],
    removed: [],
  };

  if (anteriorDetails.length > 0 && anteriorProduct) {
    if (beforeAnterior.existed) {
      summary.updated.push({
        kind: "anterior",
        product: anteriorProduct.name,
        quantity: anteriorDetails.length,
      });
    } else {
      summary.added.push({
        kind: "anterior",
        product: anteriorProduct.name,
        quantity: anteriorDetails.length,
      });
    }
  } else if (beforeAnterior.existed) {
    summary.removed.push("anterior");
  }

  if (posteriorDetails.length > 0 && posteriorProduct) {
    if (beforePosterior.existed) {
      summary.updated.push({
        kind: "posterior",
        product: posteriorProduct.name,
        quantity: posteriorDetails.length,
      });
    } else {
      summary.added.push({
        kind: "posterior",
        product: posteriorProduct.name,
        quantity: posteriorDetails.length,
      });
    }
  } else if (beforePosterior.existed) {
    summary.removed.push("posterior");
  }

  const focusLineId =
    summary.added.length > 0
      ? newSegments.find((line) =>
          summary.added.some((a) => a.kind === line.teethKind),
        )?.id ?? null
      : newSegments[0]?.id ?? null;

  return { ok: true, lines: resultLines, summary, focusLineId };
}

export function findTeethSiblingLineIndex(
  lines: ProductLineDraft[],
  anchorIndex: number,
): number | null {
  const anchor = lines[anchorIndex];
  if (!anchor?.teethProductLine) return null;
  const idx = lines.findIndex(
    (line, i) => i !== anchorIndex && isPairedTeethLine(line, anchor),
  );
  return idx >= 0 ? idx : null;
}

export function countTeethDetailsByKind(
  details: TeethLineDetail[] | undefined,
): { anterior: number; posterior: number } {
  if (!details?.length) return { anterior: 0, posterior: 0 };
  let anterior = 0;
  let posterior = 0;
  for (const d of details) {
    if (d.kind === "posterior") posterior++;
    else anterior++;
  }
  return { anterior, posterior };
}
