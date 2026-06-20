import { addMonths, startOfMonth, subMonths } from "date-fns";
import { formatDateString, parseDateOnly } from "@/lib/orders/dates";
import { orderPlacementAt } from "@/lib/orders/order-timing";
import type { IndividualOrder } from "@/types/database";
import { defaultZdSearchDataOd } from "@/lib/subiekt/subiekt-runtime-cache";

/** Pierwsza faza sync ETA — ostatnie 30 dni (wystarcza w większości przypadków). */
export const ZD_CONTRACTOR_INITIAL_DAYS = 30;

/** Druga faza (per pozycja) — maks. 3 miesiące wstecz od dziś. */
export const ZD_CONTRACTOR_EXTENDED_MONTHS = 3;

/** Bufor przed datą zamówienia — ZD bywa wystawione tuż wcześniej. */
export const ZD_CONTRACTOR_PLACEMENT_BUFFER_DAYS = 14;

/** Po zamówieniu — ZD może pojawić się z opóźnieniem (np. lutowe zgłoszenie, ZD w marcu). */
export const ZD_CONTRACTOR_POST_PLACEMENT_DAYS = 120;

/** Twardy limit wstecz — ochrona przed przeszukiwaniem wielu lat. */
export const ZD_CONTRACTOR_MAX_LOOKBACK_MONTHS = 18;

/** Browse / lista API — miesiące wstecz od miesiąca zgłoszenia (np. ZD tuż przed zamówieniem). */
export const ZD_PLACEMENT_BROWSE_MONTHS_BEFORE = 1;

/** Browse — miesiące naprzód od miesiąca zgłoszenia (ZD bywa wystawione z opóźnieniem). */
export const ZD_PLACEMENT_BROWSE_MONTHS_AFTER = 2;

export type ZdMonthBrowseChunk = {
  dataOd: string;
  /** Wyłączna górna granica (pierwszy dzień następnego miesiąca). */
  dataDo: string;
};

/** @deprecated użyj {@link ZD_CONTRACTOR_EXTENDED_MONTHS} */
export const ZD_CONTRACTOR_RECENT_MONTHS = ZD_CONTRACTOR_EXTENDED_MONTHS;

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parsePlacementDate(placementIso: string): Date | null {
  const key = placementIso.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const d = new Date(`${key}T12:00:00Z`);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** Najwcześniejsza dopuszczalna data wyszukiwania (limit lookback). */
export function zdContractorMaxLookbackDataOd(at: Date = new Date()): string {
  const d = new Date(at);
  d.setMonth(d.getMonth() - ZD_CONTRACTOR_MAX_LOOKBACK_MONTHS);
  return dateKey(d);
}

function clampDataOd(dataOd: string, at: Date = new Date()): string {
  const floor = zdContractorMaxLookbackDataOd(at);
  return dataOd < floor ? floor : dataOd;
}

/** Dolna granica pierwszej fazy (ostatnie 30 dni). */
export function zdContractorInitialDataOd(at: Date = new Date()): string {
  const d = new Date(at);
  d.setDate(d.getDate() - ZD_CONTRACTOR_INITIAL_DAYS);
  return dateKey(d);
}

/** Dolna granica rozszerzonego szukania (do 3 miesięcy wstecz od dziś). */
export function zdContractorExtendedDataOd(at: Date = new Date()): string {
  const d = new Date(at);
  d.setMonth(d.getMonth() - ZD_CONTRACTOR_EXTENDED_MONTHS);
  return dateKey(d);
}

/** Alias rozszerzonego zakresu — kompatybilność wsteczna. */
export function zdContractorRecentDataOd(at: Date = new Date()): string {
  return zdContractorExtendedDataOd(at);
}

/** Dolna granica okna wokół daty zamówienia / zgłoszenia. */
export function zdDataOdFromPlacement(
  placementIso: string,
  at: Date = new Date()
): string {
  const placement = parsePlacementDate(placementIso);
  if (!placement) return zdContractorExtendedDataOd(at);
  const d = new Date(placement);
  d.setDate(d.getDate() - ZD_CONTRACTOR_PLACEMENT_BUFFER_DAYS);
  return clampDataOd(dateKey(d), at);
}

/** Górna granica okna — wyklucza ZD wystawione długo przed zamówieniem. */
export function zdDataDoFromPlacement(placementIso: string): string | undefined {
  const placement = parsePlacementDate(placementIso);
  if (!placement) return undefined;
  const d = new Date(placement);
  d.setDate(d.getDate() + ZD_CONTRACTOR_POST_PLACEMENT_DAYS);
  return dateKey(d);
}

/** Szersze z: rolling 30d i okno od daty prośby. */
export function zdContractorInitialDataOdForPlacement(
  placementIso: string | null | undefined,
  at: Date = new Date()
): string {
  const rolling = zdContractorInitialDataOd(at);
  if (!placementIso?.trim()) return rolling;
  const fromPlacement = zdDataOdFromPlacement(placementIso, at);
  return clampDataOd(fromPlacement < rolling ? fromPlacement : rolling, at);
}

/** Szersze z: rolling 3m i okno od daty prośby (np. zgłoszenie z lutego przy sync w czerwcu). */
export function zdContractorExtendedDataOdForPlacement(
  placementIso: string | null | undefined,
  at: Date = new Date()
): string {
  const rolling = zdContractorExtendedDataOd(at);
  if (!placementIso?.trim()) return rolling;
  const fromPlacement = zdDataOdFromPlacement(placementIso, at);
  return clampDataOd(fromPlacement < rolling ? fromPlacement : rolling, at);
}

/** Data zgłoszenia / zamówienia do wyznaczenia okna ZD. */
export function zdSearchPlacementAt(
  order: Pick<IndividualOrder, "ordered_at" | "action_at" | "status">
): string | null {
  return orderPlacementAt(order) ?? order.action_at ?? null;
}

/** Najwcześniejsza dolna granica dla wielu prośb (np. cały dostawca w sync). */
export function earliestZdContractorExtendedDataOd(
  placements: readonly (string | null | undefined)[],
  at: Date = new Date()
): string {
  let earliest = zdContractorExtendedDataOd(at);
  for (const placement of placements) {
    if (!placement?.trim()) continue;
    const od = zdContractorExtendedDataOdForPlacement(placement, at);
    if (od < earliest) earliest = od;
  }
  return earliest;
}

export function earliestZdContractorInitialDataOd(
  placements: readonly (string | null | undefined)[],
  at: Date = new Date()
): string {
  let earliest = zdContractorInitialDataOd(at);
  for (const placement of placements) {
    if (!placement?.trim()) continue;
    const od = zdContractorInitialDataOdForPlacement(placement, at);
    if (od < earliest) earliest = od;
  }
  return earliest;
}

/** Ogólne wyszukiwanie produktowe (bez kh_Id) — szerszy zakres niż u kontrahenta. */
export function zdProductSearchDataOd(): string {
  return defaultZdSearchDataOd(18);
}

function monthBrowseChunkFromAnchor(monthAnchor: Date): ZdMonthBrowseChunk {
  const start = startOfMonth(monthAnchor);
  return {
    dataOd: formatDateString(start),
    dataDo: formatDateString(addMonths(start, 1)),
  };
}

function recentCalendarMonthChunks(at: Date, monthCount: number): ZdMonthBrowseChunk[] {
  const chunks: ZdMonthBrowseChunk[] = [];
  for (let i = monthCount - 1; i >= 0; i--) {
    chunks.push(monthBrowseChunkFromAnchor(subMonths(startOfMonth(at), i)));
  }
  return chunks;
}

/** Czy zgłoszenie jest starsze niż rolling 3m — wymaga okien miesięcznych wokół daty prośby. */
export function placementIsOlderThanRollingWindow(
  placementIso: string | null | undefined,
  at: Date = new Date()
): boolean {
  if (!placementIso?.trim()) return false;
  return zdDataOdFromPlacement(placementIso, at) < zdContractorExtendedDataOd(at);
}

/**
 * Kolejne okna miesięczne do browse / filtrowania indeksu.
 * Stare zgłoszenie: miesiąc wstecz + miesiąc zgłoszenia + 2 miesiące naprzód.
 * Świeże: ostatnie 3 miesiące kalendarzowe.
 */
export function zdPlacementBrowseMonthChunks(
  placementIso: string | null | undefined,
  at: Date = new Date()
): ZdMonthBrowseChunk[] {
  if (!placementIso?.trim() || !placementIsOlderThanRollingWindow(placementIso, at)) {
    return recentCalendarMonthChunks(at, ZD_CONTRACTOR_EXTENDED_MONTHS);
  }

  const placement = parseDateOnly(placementIso);
  if (!placement) return recentCalendarMonthChunks(at, ZD_CONTRACTOR_EXTENDED_MONTHS);

  const postExclusive = zdDataDoFromPlacement(placementIso);
  const todayKey = dateKey(at);
  let cursor = subMonths(startOfMonth(placement), ZD_PLACEMENT_BROWSE_MONTHS_BEFORE);
  const lastMonthStart = startOfMonth(
    addMonths(startOfMonth(placement), ZD_PLACEMENT_BROWSE_MONTHS_AFTER)
  );

  const chunks: ZdMonthBrowseChunk[] = [];
  while (cursor <= lastMonthStart) {
    const chunk = monthBrowseChunkFromAnchor(cursor);
    if (postExclusive && chunk.dataOd >= postExclusive) break;
    if (chunk.dataOd > todayKey) break;
    chunks.push(chunk);
    cursor = addMonths(cursor, 1);
  }

  return chunks.length ? chunks : [monthBrowseChunkFromAnchor(placement)];
}

/** Priorytet: miesiąc zgłoszenia, potem sąsiednie miesiące. */
export function sortMonthChunksNearPlacement(
  chunks: readonly ZdMonthBrowseChunk[],
  placementIso: string | null | undefined
): ZdMonthBrowseChunk[] {
  if (!placementIso?.trim()) return [...chunks];
  const key = placementIso.trim().slice(0, 10);
  const target = new Date(`${key}T12:00:00`).getTime();
  if (!Number.isFinite(target)) return [...chunks];

  const distance = (chunk: ZdMonthBrowseChunk): number => {
    if (key >= chunk.dataOd && key < chunk.dataDo) return 0;
    const start = new Date(`${chunk.dataOd}T12:00:00`).getTime();
    const end = new Date(`${chunk.dataDo}T12:00:00`).getTime();
    if (target < start) return start - target;
    if (target >= end) return target - end + 1;
    return 0;
  };

  return [...chunks].sort((a, b) => distance(a) - distance(b));
}

export function zdPlacementIssueDateInBrowseWindow(
  issueDate: string | null | undefined,
  placementIso: string | null | undefined,
  at: Date = new Date()
): boolean {
  const key = issueDate?.trim().slice(0, 10);
  if (!key) return true;
  return zdPlacementBrowseMonthChunks(placementIso, at).some(
    (chunk) => key >= chunk.dataOd && key < chunk.dataDo
  );
}

/** Jedno okno listy API dla live search — spółny zakres miesięcznych chunków. */
export function zdPlacementListWindowForApi(
  placementIso: string | null | undefined,
  at: Date = new Date()
): { dataOd: string; dataDo?: string } {
  const chunks = zdPlacementBrowseMonthChunks(placementIso, at);
  if (!chunks.length) {
    return { dataOd: zdContractorInitialDataOdForPlacement(placementIso, at) };
  }
  return {
    dataOd: chunks[0]!.dataOd,
    dataDo: chunks[chunks.length - 1]!.dataDo,
  };
}
