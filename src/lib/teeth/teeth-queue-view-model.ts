/**
 * Model widoku kolejki zębów (/zeby/kolejka) — czyste funkcje bez Reacta.
 *
 * Operator pracuje na prośbach (jedna prośba = jeden wiersz), a do dostawcy
 * zamawia zestawienie zbiorcze (kolor · fason · szczęka · typ × szt.).
 */

import type { TeethQueueItem } from "@/lib/data/teeth-queue-shared";
import {
  TEETH_KIND_LABELS,
  TEETH_PRODUCT_LINES,
  teethProductLineLabel,
  type TeethJaw,
  type TeethKind,
} from "@/lib/teeth/teeth-catalog";
import { parseTeethJaw, parseTeethKind, type TeethProductLine } from "@/lib/teeth/teeth-catalog-types";
import { jawRequiredForKind, mouldEncodesExplicitJaw } from "@/lib/teeth/teeth-mould-shape-groups";
import {
  orderHasIncompleteTeethSpec,
  orderHasTeethList,
} from "@/lib/teeth/teeth-panel-filters";
import {
  resolveTeethProductLineForPanelOrder,
  type TeethPanelReadinessContext,
} from "@/lib/teeth/teeth-panel-order-readiness";
import { teethQueueOrderNeedsHeaderData } from "@/lib/teeth/teeth-queue-gate";

export type TeethSpecLine = {
  key: string;
  color: string;
  mould: string | null;
  jaw: TeethJaw | null;
  kind: TeethKind | null;
  /** Pozycje jeszcze niezamówione (do zaznaczenia). */
  unorderedPositions: number[];
  orderedCount: number;
  total: number;
};

/** Szczęka ma sens tylko dla typów, które jej wymagają, i gdy fason jej nie koduje. */
export function teethJawLabel(
  jaw: TeethJaw | null,
  kind: TeethKind | null,
  mould?: string | null,
): string | null {
  if (!kind || !jawRequiredForKind(kind)) return null;
  if (mouldEncodesExplicitJaw(mould)) return null;
  if (jaw === "upper") return "góra";
  if (jaw === "lower") return "dół";
  return null;
}

export function teethKindLabel(kind: TeethKind | null): string | null {
  return kind ? TEETH_KIND_LABELS[kind].toLowerCase() : null;
}

/** „A2 · N5U · góra · boczne” — bez pustych części. */
export function formatTeethSpecLabel(line: Pick<TeethSpecLine, "color" | "mould" | "jaw" | "kind">): string {
  const parts = [
    line.color?.trim() || null,
    line.mould?.trim() || null,
    teethJawLabel(line.jaw, line.kind, line.mould),
    teethKindLabel(line.kind),
  ].filter((p): p is string => Boolean(p));
  return parts.length > 0 ? parts.join(" · ") : "—";
}

function specKeyOf(color: string, mould: string | null, jaw: TeethJaw | null, kind: TeethKind | null) {
  return `${color}|${mould ?? ""}|${jaw ?? ""}|${kind ?? ""}`;
}

/** Linie specyfikacji jednej prośby (identyczne zęby zsumowane). */
export function teethOrderSpecLines(item: Pick<TeethQueueItem, "teeth_details">): TeethSpecLine[] {
  const lines = new Map<string, TeethSpecLine>();
  for (const d of item.teeth_details ?? []) {
    const jaw = parseTeethJaw(d.jaw, d.size);
    const kind = parseTeethKind(d.kind);
    const key = specKeyOf(d.color, d.mould, jaw, kind);
    let line = lines.get(key);
    if (!line) {
      line = {
        key,
        color: d.color,
        mould: d.mould,
        jaw,
        kind,
        unorderedPositions: [],
        orderedCount: 0,
        total: 0,
      };
      lines.set(key, line);
    }
    line.total++;
    if (d.ordered_at != null) line.orderedCount++;
    else line.unorderedPositions.push(d.position);
  }
  return [...lines.values()];
}

export type TeethOrderQueueState =
  | "ready"
  | "missing_list"
  | "incomplete"
  | "needs_header"
  | "informacja";

/** Najważniejszy stan prośby w kolejce — jeden, żeby operator wiedział, co zrobić. */
export function teethOrderQueueState(
  item: TeethQueueItem,
  ctx?: TeethPanelReadinessContext,
): TeethOrderQueueState {
  if (item.request_kind === "informacja") return "informacja";
  if (!orderHasTeethList(item)) return "missing_list";
  if (orderHasIncompleteTeethSpec(item, ctx)) return "incomplete";
  if (teethQueueOrderNeedsHeaderData(item)) return "needs_header";
  return "ready";
}

export const TEETH_ORDER_STATE_LABELS: Record<TeethOrderQueueState, string> = {
  ready: "Gotowa",
  missing_list: "Brak listy zębów",
  incomplete: "Niepełna lista",
  needs_header: "Niepełna prośba",
  informacja: "Informacja",
};

export function teethOrderStateNeedsFix(state: TeethOrderQueueState): boolean {
  return state === "missing_list" || state === "incomplete" || state === "needs_header";
}

export function teethOrderUnorderedPositions(item: Pick<TeethQueueItem, "teeth_details">): number[] {
  return (item.teeth_details ?? []).filter((d) => !d.ordered_at).map((d) => d.position);
}

export type TeethAggregateLine = Omit<TeethSpecLine, "unorderedPositions" | "orderedCount" | "total"> & {
  quantity: number;
  orderCount: number;
};

/**
 * Zestawienie do złożenia zamówienia u dostawcy: tylko niezamówione zęby,
 * zsumowane po specyfikacji ze wszystkich próśb grupy.
 */
export function aggregateTeethSupplierOrder(items: TeethQueueItem[]): TeethAggregateLine[] {
  const map = new Map<string, TeethAggregateLine & { orders: Set<string> }>();
  for (const item of items) {
    for (const line of teethOrderSpecLines(item)) {
      const qty = line.unorderedPositions.length;
      if (qty === 0) continue;
      let agg = map.get(line.key);
      if (!agg) {
        agg = {
          key: line.key,
          color: line.color,
          mould: line.mould,
          jaw: line.jaw,
          kind: line.kind,
          quantity: 0,
          orderCount: 0,
          orders: new Set(),
        };
        map.set(line.key, agg);
      }
      agg.quantity += qty;
      agg.orders.add(item.id);
    }
  }
  return [...map.values()]
    .map(({ orders, ...rest }) => ({ ...rest, orderCount: orders.size }))
    .sort(
      (a, b) =>
        (a.kind ?? "").localeCompare(b.kind ?? "") ||
        a.color.localeCompare(b.color, "pl", { numeric: true }) ||
        (a.mould ?? "").localeCompare(b.mould ?? "", "pl", { numeric: true }) ||
        (a.jaw ?? "").localeCompare(b.jaw ?? ""),
    );
}

/** Tekst do schowka — wklejany do maila / arkusza dostawcy. */
export function formatTeethAggregateForClipboard(
  supplierName: string,
  lines: TeethAggregateLine[],
): string {
  const total = lines.reduce((sum, l) => sum + l.quantity, 0);
  const rows = lines.map((l) => {
    const cols = [
      l.color || "—",
      l.mould?.trim() || "—",
      teethJawLabel(l.jaw, l.kind, l.mould) ?? "—",
      teethKindLabel(l.kind) ?? "—",
      `${l.quantity} szt.`,
    ];
    return cols.join("\t");
  });
  return [
    `Zamówienie zębów — ${supplierName}`,
    ["Kolor", "Fason", "Szczęka", "Typ", "Ilość"].join("\t"),
    ...rows,
    `Razem: ${total} szt.`,
  ].join("\n");
}

/** Etykieta sekcji dla próśb, których linii nie udało się rozpoznać. */
export const TEETH_UNKNOWN_LINE_LABEL = "Linia nierozpoznana";

export type TeethQueueLineSection = {
  key: string;
  productLine: TeethProductLine | null;
  label: string;
  items: TeethQueueItem[];
};

const LINE_ORDER = new Map<string, number>(TEETH_PRODUCT_LINES.map((d, i) => [d.id, i]));

/**
 * Podział próśb jednego dostawcy na linie produktowe (np. Ivoclar: Phonares II,
 * Vivodent DCL…) — każda linia to osobny towar u dostawcy. Kolejność jak w
 * katalogu, nierozpoznane na końcu.
 */
export function groupTeethQueueByProductLine(
  items: TeethQueueItem[],
  ctx?: TeethPanelReadinessContext,
): TeethQueueLineSection[] {
  const sections = new Map<string, TeethQueueLineSection>();
  for (const item of items) {
    const productLine = resolveTeethProductLineForPanelOrder(item, ctx);
    const key = productLine ?? "__unknown";
    let section = sections.get(key);
    if (!section) {
      section = {
        key,
        productLine,
        label: teethProductLineLabel(productLine) ?? TEETH_UNKNOWN_LINE_LABEL,
        items: [],
      };
      sections.set(key, section);
    }
    section.items.push(item);
  }
  const rank = (s: TeethQueueLineSection) =>
    s.productLine ? (LINE_ORDER.get(s.productLine) ?? LINE_ORDER.size) : LINE_ORDER.size + 1;
  return [...sections.values()].sort((a, b) => rank(a) - rank(b));
}

export type TeethAggregateSection = {
  key: string;
  productLine: TeethProductLine | null;
  label: string;
  lines: TeethAggregateLine[];
  total: number;
};

/** Zestawienie do zamówienia rozbite na linie — ten sam kolor w Phonares i Vivodent to inny towar. */
export function aggregateTeethSupplierOrderByLine(
  items: TeethQueueItem[],
  ctx?: TeethPanelReadinessContext,
): TeethAggregateSection[] {
  return groupTeethQueueByProductLine(items, ctx)
    .map((section) => {
      const lines = aggregateTeethSupplierOrder(section.items);
      return {
        key: section.key,
        productLine: section.productLine,
        label: section.label,
        lines,
        total: lines.reduce((sum, l) => sum + l.quantity, 0),
      };
    })
    .filter((section) => section.lines.length > 0);
}

/** Tekst do schowka z nagłówkiem każdej linii produktowej. */
export function formatTeethAggregateSectionsForClipboard(
  supplierName: string,
  sections: TeethAggregateSection[],
): string {
  const total = sections.reduce((sum, s) => sum + s.total, 0);
  const blocks = sections.map((s) => {
    const rows = s.lines.map((l) =>
      [
        l.color || "—",
        l.mould?.trim() || "—",
        teethJawLabel(l.jaw, l.kind, l.mould) ?? "—",
        teethKindLabel(l.kind) ?? "—",
        `${l.quantity} szt.`,
      ].join("\t"),
    );
    return [`${s.label} (${s.total} szt.)`, ...rows].join("\n");
  });
  return [
    `Zamówienie zębów — ${supplierName}`,
    ["Kolor", "Fason", "Szczęka", "Typ", "Ilość"].join("\t"),
    ...blocks.flatMap((b, i) => (i === 0 ? [b] : ["", b])),
    `Razem: ${total} szt.`,
  ].join("\n");
}

/** Czy oznaczenie dotyczy tylko zaznaczonych zębów, czy wszystkich u dostawcy. */
export type TeethMarkScope = "selection" | "all";

export type TeethMarkPlanRow = {
  orderId: string;
  who: string;
  context: string | null;
  lineLabel: string;
  /** Ile zębów tej prośby zostanie oznaczonych. */
  marking: number;
  /** Ile zębów tej prośby jest jeszcze niezamówionych (przed oznaczeniem). */
  open: number;
};

export type TeethMarkPlan = {
  rows: TeethMarkPlanRow[];
  markCount: number;
  /** Niezamówione zęby u tych samych dostawców, które NIE zostaną oznaczone. */
  leftInQueue: number;
};

/**
 * Podgląd oznaczenia przed potwierdzeniem: tylko prośby gotowe (`readyIds`),
 * tylko faktycznie niezamówione pozycje — tak jak zrobi to serwer.
 */
export function buildTeethMarkPlan(
  selections: Array<{ orderId: string; positions: number[] }>,
  ordersById: ReadonlyMap<string, TeethQueueItem>,
  readyIds: ReadonlySet<string>,
  ctx?: TeethPanelReadinessContext,
): TeethMarkPlan {
  const rows: TeethMarkPlanRow[] = [];
  const suppliers = new Set<string>();
  for (const sel of selections) {
    const order = ordersById.get(sel.orderId);
    if (!order) continue;
    suppliers.add(order.supplier_id ?? "");
    if (!readyIds.has(sel.orderId)) continue;
    const open = teethOrderUnorderedPositions(order);
    const openSet = new Set(open);
    const marking = new Set(sel.positions.filter((p) => openSet.has(p))).size;
    if (marking === 0) continue;
    const context = [order.sales_client_name?.trim(), order.source_zk_number?.trim()]
      .filter(Boolean)
      .join(" · ");
    rows.push({
      orderId: order.id,
      who: order.sales_person_name ?? "Bez handlowca",
      context: context || null,
      lineLabel:
        teethProductLineLabel(resolveTeethProductLineForPanelOrder(order, ctx)) ??
        TEETH_UNKNOWN_LINE_LABEL,
      marking,
      open: open.length,
    });
  }
  const markCount = rows.reduce((sum, r) => sum + r.marking, 0);
  let openAtSuppliers = 0;
  for (const order of ordersById.values()) {
    if (suppliers.has(order.supplier_id ?? "")) {
      openAtSuppliers += teethOrderUnorderedPositions(order).length;
    }
  }
  rows.sort(
    (a, b) =>
      a.lineLabel.localeCompare(b.lineLabel, "pl", { sensitivity: "base" }) ||
      a.who.localeCompare(b.who, "pl", { sensitivity: "base" }),
  );
  return { rows, markCount, leftInQueue: Math.max(0, openAtSuppliers - markCount) };
}

/** Zaznaczenie zawężone do próśb jednego dostawcy (tylko niezamówione pozycje). */
export function teethSelectionsForItems(
  items: TeethQueueItem[],
  positionSelection: ReadonlyMap<string, ReadonlySet<number>>,
): Array<{ orderId: string; positions: number[] }> {
  const result: Array<{ orderId: string; positions: number[] }> = [];
  for (const item of items) {
    const sel = positionSelection.get(item.id);
    if (!sel?.size) continue;
    const positions = teethOrderUnorderedPositions(item).filter((p) => sel.has(p));
    if (positions.length > 0) result.push({ orderId: item.id, positions });
  }
  return result;
}
