import type { IndividualOrder } from "@/types/database";
import type { TeethGroupedDetail } from "@/lib/teeth/teeth-catalog";
import {
  buildTeethReceiveLineDeliveredToSave,
  computeTeethReceiveTotalToSave,
  teethReceiveAlreadyDelivered,
  teethReceiveDeliveredAllocationByGroup,
  teethReceiveFillAllSession,
  teethReceiveFillSession,
  teethReceiveGroupKey,
  teethReceiveGroupsFromOrder,
  teethReceiveHasSessionInput,
  teethReceiveLineRemaining,
  teethReceiveRemaining,
  toLineDetails,
} from "@/lib/teeth/teeth-receive-picker";
import {
  sortTeethReceiveOrders,
  teethReceiveSalesPersonKey,
} from "@/lib/orders/receive-queue-teeth";
import { orderHasTeethList } from "@/lib/teeth/teeth-panel-filters";
import {
  resolveTeethProductLineForPanelOrder,
  teethPanelProductLineLabelForOrder,
  type TeethPanelReadinessContext,
} from "@/lib/teeth/teeth-panel-order-readiness";
import type { TeethProductLine } from "@/lib/teeth/teeth-catalog";

export function teethReceiveRowKey(orderId: string, groupKey: string): string {
  return `${orderId}\0${groupKey}`;
}

export function teethReceiveManualRowKey(orderId: string): string {
  return `${orderId}\0__manual`;
}

export function lineQtyForOrder(
  orderId: string,
  flatLineQty: Record<string, string>,
): Record<string, string> {
  const prefix = `${orderId}\0`;
  const result: Record<string, string> = {};
  for (const [rowKey, value] of Object.entries(flatLineQty)) {
    if (!rowKey.startsWith(prefix) || rowKey === teethReceiveManualRowKey(orderId)) continue;
    const groupKey = rowKey.slice(prefix.length);
    if (groupKey) result[groupKey] = value;
  }
  return result;
}

export type TeethReceiveSpecRow = {
  kind: "spec";
  rowKey: string;
  orderId: string;
  order: IndividualOrder;
  salesPersonName: string;
  salesPersonKey: string;
  stripeIndex: number;
  group: TeethGroupedDetail;
  groupKey: string;
};

export type TeethReceiveManualRow = {
  kind: "manual";
  rowKey: string;
  orderId: string;
  order: IndividualOrder;
  salesPersonName: string;
  salesPersonKey: string;
  stripeIndex: number;
  productLabel: string;
  incompleteSpec: boolean;
};

export type TeethReceiveFlatRow = TeethReceiveSpecRow | TeethReceiveManualRow;

export function buildTeethReceiveFlatRows(
  orders: IndividualOrder[],
  canPickSpec: (order: IndividualOrder) => boolean,
): TeethReceiveFlatRow[] {
  const sorted = sortTeethReceiveOrders(orders);
  const stripeKeys: string[] = [];
  const rows: TeethReceiveFlatRow[] = [];

  for (const order of sorted) {
    const salesPersonKey = teethReceiveSalesPersonKey(order);
    if (!stripeKeys.includes(salesPersonKey)) stripeKeys.push(salesPersonKey);
    const stripeIndex = stripeKeys.indexOf(salesPersonKey);
    const salesPersonName = order.sales_person?.name?.trim() || "—";

    if (canPickSpec(order) && orderHasTeethList(order)) {
      const groups = teethReceiveGroupsFromOrder(toLineDetails(order.teeth_details));
      for (const group of groups) {
        const groupKey = teethReceiveGroupKey(group);
        if (teethReceiveLineRemaining(order, group, groups) <= 0) continue;
        rows.push({
          kind: "spec",
          rowKey: teethReceiveRowKey(order.id, groupKey),
          orderId: order.id,
          order,
          salesPersonName,
          salesPersonKey,
          stripeIndex,
          group,
          groupKey,
        });
      }
      continue;
    }

    const incompleteSpec = orderHasTeethList(order) && !canPickSpec(order);
    rows.push({
      kind: "manual",
      rowKey: teethReceiveManualRowKey(order.id),
      orderId: order.id,
      order,
      salesPersonName,
      salesPersonKey,
      stripeIndex,
      productLabel: order.products?.trim() || "—",
      incompleteSpec,
    });
  }

  return rows;
}

export function teethReceiveFlatRowCountForOrder(
  rows: TeethReceiveFlatRow[],
  orderId: string,
): number {
  return rows.filter((row) => row.orderId === orderId).length;
}

export function teethReceiveRowMeta(
  rows: TeethReceiveFlatRow[],
  rowIndex: number,
): {
  isFirstInOrder: boolean;
  orderRowSpan: number;
  isNewSalesPerson: boolean;
  salesPersonBlockLength: number;
  isLastInSalesPersonBlock: boolean;
} {
  const row = rows[rowIndex]!;
  const isFirstInOrder =
    rowIndex === 0 || rows[rowIndex - 1]!.orderId !== row.orderId;
  const isNewSalesPerson =
    rowIndex === 0 || rows[rowIndex - 1]!.salesPersonKey !== row.salesPersonKey;
  const isLastInSalesPersonBlock =
    rowIndex === rows.length - 1 ||
    rows[rowIndex + 1]!.salesPersonKey !== row.salesPersonKey;
  return {
    isFirstInOrder,
    orderRowSpan: teethReceiveFlatRowCountForOrder(rows, row.orderId),
    isNewSalesPerson,
    salesPersonBlockLength: teethReceiveSalesPersonBlockLength(rows, rowIndex),
    isLastInSalesPersonBlock,
  };
}

export function teethReceiveSalesPersonBlockLength(
  rows: TeethReceiveFlatRow[],
  startIndex: number,
): number {
  const key = rows[startIndex]!.salesPersonKey;
  let count = 0;
  for (let i = startIndex; i < rows.length; i++) {
    if (rows[i]!.salesPersonKey !== key) break;
    count += 1;
  }
  return count;
}

export function teethReceiveOrderIdsWithSessionInput(
  orders: IndividualOrder[],
  flatLineQty: Record<string, string>,
  manualQty: Record<string, string>,
  canPickSpec: (order: IndividualOrder) => boolean,
): string[] {
  return orders
    .filter((order) =>
      teethReceiveOrderHasSessionInput(order, flatLineQty, manualQty, canPickSpec),
    )
    .map((order) => order.id);
}

export function countTeethReceiveFlatRowsBySalesPerson(
  rows: TeethReceiveFlatRow[],
): { key: string; name: string; stripeIndex: number; count: number }[] {
  const result: { key: string; name: string; stripeIndex: number; count: number }[] = [];
  for (const row of rows) {
    const existing = result.find((r) => r.key === row.salesPersonKey);
    if (existing) {
      existing.count += 1;
    } else {
      result.push({
        key: row.salesPersonKey,
        name: row.salesPersonName,
        stripeIndex: row.stripeIndex,
        count: 1,
      });
    }
  }
  return result;
}

export function countTeethReceiveSalesPersons(rows: TeethReceiveFlatRow[]): number {
  return new Set(rows.map((row) => row.salesPersonKey)).size;
}

export type TeethReceiveProductLineGroup = {
  groupKey: string;
  productLine: TeethProductLine | null;
  productLineLabel: string;
  orders: IndividualOrder[];
  supplierNames: string[];
};

export function teethReceiveProductLineGroupKey(
  order: IndividualOrder,
  ctx: TeethPanelReadinessContext,
): string {
  return teethPanelProductLineLabelForOrder(order, ctx) ?? "Inna linia";
}

export function groupTeethReceiveByProductLine(
  orders: IndividualOrder[],
  ctx: TeethPanelReadinessContext,
): TeethReceiveProductLineGroup[] {
  const buckets = new Map<string, TeethReceiveProductLineGroup>();

  for (const order of orders) {
    const productLine = resolveTeethProductLineForPanelOrder(order, ctx);
    const label = teethPanelProductLineLabelForOrder(order, ctx) ?? "Inna linia";
    const key = label;
    const supplierName = order.supplier?.name?.trim() || "—";
    const existing = buckets.get(key);
    if (existing) {
      existing.orders.push(order);
      if (!existing.supplierNames.includes(supplierName)) {
        existing.supplierNames.push(supplierName);
      }
    } else {
      buckets.set(key, {
        groupKey: key,
        productLine,
        productLineLabel: label,
        orders: [order],
        supplierNames: [supplierName],
      });
    }
  }

  return [...buckets.values()]
    .map((group) => ({
      ...group,
      orders: sortTeethReceiveOrders(group.orders),
      supplierNames: [...group.supplierNames].sort((a, b) =>
        a.localeCompare(b, "pl", { sensitivity: "base" }),
      ),
    }))
    .sort((a, b) =>
      a.productLineLabel.localeCompare(b.productLineLabel, "pl", { sensitivity: "base" }),
    );
}

export function countTeethReceiveOrdersByProductLine(
  orders: IndividualOrder[],
  ctx: TeethPanelReadinessContext,
): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const order of orders) {
    const label = teethPanelProductLineLabelForOrder(order, ctx) ?? "Inna linia";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => a.label.localeCompare(b.label, "pl", { sensitivity: "base" }));
}

export function formatTeethReceiveProductLineSummary(
  group: TeethReceiveProductLineGroup,
  lineCount: number,
): string {
  const parts = [
    `${group.orders.length} ${group.orders.length === 1 ? "zamówienie" : "zamówienia"}`,
    `${lineCount} ${lineCount === 1 ? "linia" : lineCount < 5 ? "linie" : "linii"}`,
  ];
  if (group.supplierNames.length > 0) {
    parts.push(`lab: ${group.supplierNames.join(", ")}`);
  }
  return parts.join(" · ");
}

export function teethReceiveClampManualSessionQty(
  order: IndividualOrder,
  rawValue: string,
): string {
  const trimmed = rawValue.trim();
  if (!trimmed) return "";
  const parsed = parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) return trimmed;
  if (parsed <= 0) return "";

  const groups = teethReceiveGroupsFromOrder(toLineDetails(order.teeth_details));
  const remaining = teethReceiveRemaining(order, groups);
  if (remaining <= 0) return "";
  return String(Math.min(parsed, remaining));
}

export function teethReceiveSaveQuantityForOrder(
  order: IndividualOrder,
  flatLineQty: Record<string, string>,
  manualQty: Record<string, string>,
  canPickSpec: (order: IndividualOrder) => boolean,
): string | null {
  if (canPickSpec(order) && orderHasTeethList(order)) {
    const groups = teethReceiveGroupsFromOrder(toLineDetails(order.teeth_details));
    const lineQty = lineQtyForOrder(order.id, flatLineQty);
    if (!teethReceiveHasSessionInput(lineQty)) return null;
    return String(computeTeethReceiveTotalToSave(order, groups, lineQty));
  }

  const manual = manualQty[order.id]?.trim();
  if (!manual) return null;
  const session = parseInt(manual, 10);
  if (!Number.isFinite(session) || session <= 0) return null;
  const groups = teethReceiveGroupsFromOrder(toLineDetails(order.teeth_details));
  const remaining = teethReceiveRemaining(order, groups);
  const clampedSession = Math.min(session, remaining);
  if (clampedSession <= 0) return null;
  return String(teethReceiveAlreadyDelivered(order) + clampedSession);
}

export function teethReceiveOrderHasSessionInput(
  order: IndividualOrder,
  flatLineQty: Record<string, string>,
  manualQty: Record<string, string>,
  canPickSpec: (order: IndividualOrder) => boolean,
): boolean {
  if (canPickSpec(order) && orderHasTeethList(order)) {
    return teethReceiveHasSessionInput(lineQtyForOrder(order.id, flatLineQty));
  }
  const manual = manualQty[order.id]?.trim();
  if (!manual) return false;
  const session = parseInt(manual, 10);
  return Number.isFinite(session) && session > 0;
}

export function teethReceiveFillFlatLinesForOrder(
  order: IndividualOrder,
  flatLineQty: Record<string, string>,
  canPickSpec: (order: IndividualOrder) => boolean,
): Record<string, string> {
  if (!canPickSpec(order) || !orderHasTeethList(order)) {
    return flatLineQty;
  }

  const groups = teethReceiveGroupsFromOrder(toLineDetails(order.teeth_details));
  const remaining = teethReceiveRemaining(order, groups);
  if (remaining <= 0) return flatLineQty;

  const allocation = teethReceiveDeliveredAllocationByGroup(order, groups);
  const fullSum = groups.reduce((sum, g) => sum + Math.max(1, g.count), 0);
  const session =
    teethReceiveAlreadyDelivered(order) === 0 && remaining >= fullSum && !order.teeth_line_delivered
      ? teethReceiveFillAllSession(groups)
      : teethReceiveFillSession(groups, remaining, allocation);

  const next = { ...flatLineQty };
  for (const group of groups) {
    const groupKey = teethReceiveGroupKey(group);
    const rowKey = teethReceiveRowKey(order.id, groupKey);
    const value = session[groupKey];
    if (value) next[rowKey] = value;
    else delete next[rowKey];
  }
  return next;
}

export function teethReceiveFillManualForOrder(
  order: IndividualOrder,
  manualQty: Record<string, string>,
): Record<string, string> {
  const groups = teethReceiveGroupsFromOrder(toLineDetails(order.teeth_details));
  let remaining = teethReceiveRemaining(order, groups);
  if (remaining <= 0) {
    const ordered = parseInt(order.quantity ?? "0", 10);
    const base = Number.isFinite(ordered) ? ordered : 0;
    remaining = Math.max(0, base - teethReceiveAlreadyDelivered(order));
  }
  if (remaining <= 0) return manualQty;
  return { ...manualQty, [order.id]: String(remaining) };
}

export function teethReceiveHasAnySessionInput(
  orders: IndividualOrder[],
  flatLineQty: Record<string, string>,
  manualQty: Record<string, string>,
  canPickSpec: (order: IndividualOrder) => boolean,
): boolean {
  return orders.some((order) =>
    teethReceiveOrderHasSessionInput(order, flatLineQty, manualQty, canPickSpec),
  );
}

export function teethReceiveFillSessionForOrders(
  orders: IndividualOrder[],
  flatLineQty: Record<string, string>,
  manualQty: Record<string, string>,
  canPickSpec: (order: IndividualOrder) => boolean,
): { flatLineQty: Record<string, string>; manualQty: Record<string, string> } {
  let flat = flatLineQty;
  let manual = manualQty;
  for (const order of orders) {
    if (canPickSpec(order) && orderHasTeethList(order)) {
      flat = teethReceiveFillFlatLinesForOrder(order, flat, canPickSpec);
    } else {
      manual = teethReceiveFillManualForOrder(order, manual);
    }
  }
  return { flatLineQty: flat, manualQty: manual };
}

export function teethReceiveClearSessionInputForOrders(
  orderIds: string[],
  flatLineQty: Record<string, string>,
  manualQty: Record<string, string>,
): { flatLineQty: Record<string, string>; manualQty: Record<string, string> } {
  const idSet = new Set(orderIds);
  const flat = { ...flatLineQty };
  for (const key of Object.keys(flat)) {
    const orderId = key.split("\0")[0];
    if (orderId && idSet.has(orderId)) delete flat[key];
  }
  const manual = { ...manualQty };
  for (const orderId of orderIds) delete manual[orderId];
  return { flatLineQty: flat, manualQty: manual };
}

export type TeethReceiveDeliveryUpdate = {
  orderId: string;
  qty: string;
  teethLineDelivered?: Record<string, number>;
};

export function buildTeethReceiveDeliveryUpdates(
  orders: IndividualOrder[],
  flatLineQty: Record<string, string>,
  manualQty: Record<string, string>,
  canPickSpec: (order: IndividualOrder) => boolean,
): TeethReceiveDeliveryUpdate[] {
  const updates: TeethReceiveDeliveryUpdate[] = [];
  for (const order of orders) {
    if (canPickSpec(order) && orderHasTeethList(order)) {
      const groups = teethReceiveGroupsFromOrder(toLineDetails(order.teeth_details));
      const lineQty = lineQtyForOrder(order.id, flatLineQty);
      if (!teethReceiveHasSessionInput(lineQty)) continue;
      updates.push({
        orderId: order.id,
        qty: String(computeTeethReceiveTotalToSave(order, groups, lineQty)),
        teethLineDelivered: buildTeethReceiveLineDeliveredToSave(order, groups, lineQty),
      });
      continue;
    }

    const qty = teethReceiveSaveQuantityForOrder(
      order,
      flatLineQty,
      manualQty,
      canPickSpec,
    );
    if (qty) updates.push({ orderId: order.id, qty });
  }
  return updates;
}
