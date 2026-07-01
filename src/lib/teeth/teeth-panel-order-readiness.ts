import type { TeethLineDetail, TeethKind, TeethManufacturer, TeethProductLine } from "@/lib/teeth/teeth-catalog";
import {
  resolveTeethCatalogFromDraft,
  teethProductLineLabel,
} from "@/lib/teeth/teeth-catalog";
import {
  normalizeTeethDetailsForSave,
  teethLineDetailsComplete,
  type TeethProductInfoLookup,
} from "@/lib/teeth/teeth-validation";
import type { IndividualOrderTeethDetail } from "@/types/database";

export type TeethPanelOrderLike = {
  teeth_details?: IndividualOrderTeethDetail[] | null | undefined;
  products?: string;
  quantity?: string;
  subiekt_tw_id?: number | null;
};

export type TeethPanelReadinessContext = {
  teethInfoByTwId?: ReadonlyMap<number, TeethProductInfoLookup>;
};

export function teethPanelReadinessContextFromMaps(maps: {
  twIds?: ReadonlySet<number>;
  productLineByTwId: ReadonlyMap<number, TeethProductLine | null>;
  manufacturerByTwId: ReadonlyMap<number, TeethManufacturer | null>;
  kindByTwId: ReadonlyMap<number, TeethKind | null>;
}): TeethPanelReadinessContext {
  const teethInfoByTwId = new Map<number, TeethProductInfoLookup>();
  const ids =
    maps.twIds ??
    new Set([
      ...maps.productLineByTwId.keys(),
      ...maps.manufacturerByTwId.keys(),
      ...maps.kindByTwId.keys(),
    ]);
  for (const twId of ids) {
    const id = Math.trunc(twId);
    if (id <= 0) continue;
    teethInfoByTwId.set(id, {
      productLine: maps.productLineByTwId.get(id) ?? null,
      manufacturer: maps.manufacturerByTwId.get(id) ?? null,
      kind: maps.kindByTwId.get(id) ?? null,
    });
  }
  return { teethInfoByTwId };
}

/** Linia katalogowa zębów dla pozycji w panelu (admin + nazwa towaru). */
export function resolveTeethProductLineForPanelOrder(
  order: Pick<TeethPanelOrderLike, "products" | "subiekt_tw_id">,
  ctx?: TeethPanelReadinessContext,
): TeethProductLine | null {
  const twId =
    order.subiekt_tw_id != null && order.subiekt_tw_id > 0
      ? Math.trunc(order.subiekt_tw_id)
      : null;
  const info = twId != null ? ctx?.teethInfoByTwId?.get(twId) : undefined;
  return (
    resolveTeethCatalogFromDraft({
      adminProductLine: info?.productLine ?? null,
      teethManufacturer: info?.manufacturer ?? null,
      product: order.products,
      subiektTwId: twId,
    })?.productLine ?? null
  );
}

export function teethPanelProductLineLabelForOrder(
  order: Pick<TeethPanelOrderLike, "products" | "subiekt_tw_id">,
  ctx?: TeethPanelReadinessContext,
): string | null {
  const line = resolveTeethProductLineForPanelOrder(order, ctx);
  return line ? teethProductLineLabel(line) : null;
}

export function distinctTeethProductLineLabelsForOrders(
  orders: Array<Pick<TeethPanelOrderLike, "products" | "subiekt_tw_id">>,
  ctx?: TeethPanelReadinessContext,
): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const order of orders) {
    const label = teethPanelProductLineLabelForOrder(order, ctx);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  return labels;
}

function toLineDetails(details: IndividualOrderTeethDetail[]): TeethLineDetail[] {
  return details.map((d) => ({
    position: d.position,
    color: d.color,
    mould: d.mould,
    jaw: d.jaw,
    kind: d.kind,
  }));
}

/** Lista zębów kompletna wg katalogu (jak w formularzu prośby / modalu listy). */
export function orderTeethListReadyForOrder(
  order: TeethPanelOrderLike,
  ctx?: TeethPanelReadinessContext,
): boolean {
  const raw = order.teeth_details;
  if (!raw?.length) return false;

  const twId =
    order.subiekt_tw_id != null && order.subiekt_tw_id > 0
      ? Math.trunc(order.subiekt_tw_id)
      : null;
  const info = twId != null ? ctx?.teethInfoByTwId?.get(twId) : undefined;
  const lineDetails = normalizeTeethDetailsForSave(toLineDetails(raw), info?.kind ?? null);

  return teethLineDetailsComplete({
    teethDetails: lineDetails ?? undefined,
    quantity: String(raw.length),
    product: info?.productLine ? order.products : undefined,
    subiektTwId: twId,
    adminProductLine: info?.productLine ?? null,
    adminManufacturer: info?.manufacturer ?? null,
    isTeethProduct: true,
  });
}
