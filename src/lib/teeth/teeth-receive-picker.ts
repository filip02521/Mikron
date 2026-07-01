import type { IndividualOrder } from "@/types/database";
import {
  groupTeethDetails,
  type TeethGroupedDetail,
  type TeethLineDetail,
} from "@/lib/teeth/teeth-catalog";
import { parseOrderQuantity } from "@/lib/orders/individual";
import { receiveQueueTargetQuantity } from "@/lib/orders/sales-cancel";

export function teethReceiveGroupKey(group: TeethGroupedDetail): string {
  return `${group.color}|${group.mould ?? ""}|${group.jaw ?? ""}|${group.kind ?? ""}`;
}

export function teethReceiveGroupsFromOrder(
  details: TeethLineDetail[] | undefined,
): TeethGroupedDetail[] {
  return groupTeethDetails(details);
}

export function teethReceiveAlreadyDelivered(order: IndividualOrder): number {
  const delivered = parseInt(order.delivered_quantity ?? "", 10);
  return Number.isFinite(delivered) && delivered > 0 ? delivered : 0;
}

export function teethReceiveOrderedTotal(
  order: IndividualOrder,
  groups: TeethGroupedDetail[],
): number {
  const target = receiveQueueTargetQuantity(order);
  if (target != null && target > 0) return target;
  const fromGroups = groups.reduce((sum, g) => sum + Math.max(1, g.count), 0);
  if (fromGroups > 0) return fromGroups;
  const ordered = parseOrderQuantity(order.quantity);
  return ordered != null && ordered > 0 ? ordered : 0;
}

export function teethReceiveRemaining(
  order: IndividualOrder,
  groups: TeethGroupedDetail[],
): number {
  return Math.max(
    0,
    teethReceiveOrderedTotal(order, groups) - teethReceiveAlreadyDelivered(order),
  );
}

function parseLineQty(value: string | undefined): number {
  const n = parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function parseTeethLineDelivered(raw: unknown): Record<string, number> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const n = typeof value === "number" ? value : parseInt(String(value), 10);
    if (Number.isFinite(n) && n > 0) result[key] = n;
  }
  return Object.keys(result).length ? result : null;
}

/** Heurystyka FIFO: rozdziela delivered_quantity po kolejności grup. */
export function teethReceiveFifoAllocation(
  order: IndividualOrder,
  groups: TeethGroupedDetail[],
): Record<string, number> {
  let left = teethReceiveAlreadyDelivered(order);
  const result: Record<string, number> = {};
  for (const group of groups) {
    if (left <= 0) break;
    const cap = Math.max(1, group.count);
    const take = Math.min(cap, left);
    if (take > 0) {
      result[teethReceiveGroupKey(group)] = take;
      left -= take;
    }
  }
  return result;
}

export function teethReceiveDeliveredAllocationByGroup(
  order: IndividualOrder,
  groups: TeethGroupedDetail[],
): Record<string, number> {
  const stored = parseTeethLineDelivered(order.teeth_line_delivered);
  if (stored) {
    const result: Record<string, number> = {};
    for (const group of groups) {
      const key = teethReceiveGroupKey(group);
      const cap = Math.max(1, group.count);
      const value = stored[key] ?? 0;
      if (value > 0) result[key] = Math.min(cap, value);
    }
    return result;
  }
  return teethReceiveFifoAllocation(order, groups);
}

export function teethReceiveLineAlreadyDelivered(
  order: IndividualOrder,
  group: TeethGroupedDetail,
  groups: TeethGroupedDetail[],
): number {
  const allocation = teethReceiveDeliveredAllocationByGroup(order, groups);
  return allocation[teethReceiveGroupKey(group)] ?? 0;
}

export function teethReceiveLineRemaining(
  order: IndividualOrder,
  group: TeethGroupedDetail,
  groups: TeethGroupedDetail[],
): number {
  const cap = Math.max(1, group.count);
  return Math.max(0, cap - teethReceiveLineAlreadyDelivered(order, group, groups));
}

export function buildTeethReceiveLineDeliveredToSave(
  order: IndividualOrder,
  groups: TeethGroupedDetail[],
  lineQty: Record<string, string>,
): Record<string, number> {
  const next = { ...teethReceiveDeliveredAllocationByGroup(order, groups) };
  for (const group of groups) {
    const key = teethReceiveGroupKey(group);
    const session = parseLineQty(lineQty[key]);
    if (!session) continue;
    const cap = Math.max(1, group.count);
    const base = next[key] ?? 0;
    next[key] = Math.min(cap, base + session);
  }
  return next;
}

export function computeTeethReceiveSessionSum(
  groups: TeethGroupedDetail[],
  lineQty: Record<string, string>,
): number {
  return groups.reduce((sum, group) => {
    const key = teethReceiveGroupKey(group);
    const n = parseLineQty(lineQty[key]);
    return sum + Math.min(n, Math.max(1, group.count));
  }, 0);
}

export function computeTeethReceiveTotalToSave(
  order: IndividualOrder,
  groups: TeethGroupedDetail[],
  lineQty: Record<string, string>,
): number {
  return teethReceiveAlreadyDelivered(order) + computeTeethReceiveSessionSum(groups, lineQty);
}

export function setTeethReceiveLineQty(
  groups: TeethGroupedDetail[],
  lineQty: Record<string, string>,
  lineKey: string,
  rawValue: string,
  remaining: number,
  lineMax?: number,
): Record<string, string> {
  const trimmed = rawValue.trim();
  if (trimmed === "") {
    const next = { ...lineQty };
    delete next[lineKey];
    return next;
  }

  const group = groups.find((g) => teethReceiveGroupKey(g) === lineKey);
  const groupCap = group ? Math.max(1, group.count) : remaining;
  const maxForLine =
    lineMax != null ? Math.min(groupCap, Math.max(0, lineMax)) : Math.min(groupCap, remaining);
  let n = parseInt(trimmed, 10);
  if (!Number.isFinite(n) || n < 0) {
    return { ...lineQty, [lineKey]: trimmed };
  }
  n = Math.min(n, maxForLine);

  const next = { ...lineQty, [lineKey]: String(n) };
  const sessionSum = computeTeethReceiveSessionSum(groups, next);
  if (sessionSum <= remaining) return next;

  const otherSum = sessionSum - n;
  const maxThis = Math.max(0, remaining - otherSum);
  return { ...lineQty, [lineKey]: String(Math.min(n, maxThis)) };
}

/** Uzupełnia bieżącą dostawę — od pierwszych grup, do wyczerpania pozostałej ilości. */
export function teethReceiveFillSession(
  groups: TeethGroupedDetail[],
  remaining: number,
  lineAlready?: Record<string, number>,
): Record<string, string> {
  if (remaining <= 0) return {};
  const result: Record<string, string> = {};
  let left = remaining;
  for (const group of groups) {
    if (left <= 0) break;
    const key = teethReceiveGroupKey(group);
    const cap = Math.max(1, group.count);
    const already = lineAlready?.[key] ?? 0;
    const lineRem = Math.max(0, cap - already);
    if (lineRem <= 0) continue;
    const take = Math.min(lineRem, left);
    result[key] = String(take);
    left -= take;
  }
  return result;
}

export function teethReceiveFillAllSession(
  groups: TeethGroupedDetail[],
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const group of groups) {
    result[teethReceiveGroupKey(group)] = String(Math.max(1, group.count));
  }
  return result;
}

export function teethReceiveHasSessionInput(lineQty: Record<string, string> | undefined): boolean {
  if (!lineQty) return false;
  return Object.values(lineQty).some((value) => parseLineQty(value) > 0);
}
