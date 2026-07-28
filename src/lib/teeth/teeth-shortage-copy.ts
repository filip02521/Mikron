import { formatPlDate } from "@/lib/display-labels";
import { warsawNowParts } from "@/lib/time/warsaw";

export type TeethShortageAvailabilityKind = "dated" | "undated" | "past";

export function classifyTeethShortageAvailability(
  availableFrom: string | null | undefined,
  todayKey = warsawNowParts().dateKey
): TeethShortageAvailabilityKind {
  const raw = availableFrom?.trim() || null;
  if (!raw) return "undated";
  if (raw < todayKey) return "past";
  return "dated";
}

/** Krótka etykieta daty / stanu dla listy działu i chipów. */
export function teethShortageAvailabilityBadgeLabel(
  availableFrom: string | null | undefined,
  todayKey = warsawNowParts().dateKey
): string {
  const kind = classifyTeethShortageAvailability(availableFrom, todayKey);
  if (kind === "undated") return "Nieustalona";
  if (kind === "past") return `Minęła ${formatPlDate(availableFrom)}`;
  return `Od ${formatPlDate(availableFrom)}`;
}

/** Pełne zdanie ostrzeżenia dla handlowca. */
export function teethShortageAvailabilityMessage(
  supplierName: string,
  availableFrom: string | null | undefined,
  todayKey = warsawNowParts().dateKey
): string {
  const name = supplierName.trim() || "dostawcy";
  const kind = classifyTeethShortageAvailability(availableFrom, todayKey);
  if (kind === "undated") {
    return `Brak u ${name} — termin dostępności nieustalony`;
  }
  if (kind === "past") {
    return `Brak u ${name} — planowana dostępność ${formatPlDate(availableFrom)} minęła (termin niepotwierdzony)`;
  }
  return `Brak u ${name} — dostępne od ${formatPlDate(availableFrom)}`;
}

export const TEETH_SHORTAGE_BANNER_TITLE =
  "Część wybranych zębów jest w braku u dostawcy";

/** Klasy badge dostępności — lista / modal handlowca. */
export function teethShortageAvailabilityBadgeClass(
  availableFrom: string | null | undefined,
  todayKey = warsawNowParts().dateKey
): string {
  const kind = classifyTeethShortageAvailability(availableFrom, todayKey);
  if (kind === "undated") {
    return "bg-amber-100 text-amber-950 ring-amber-300/70";
  }
  if (kind === "past") {
    return "bg-rose-50 text-rose-900 ring-rose-200/80";
  }
  return "bg-slate-100 text-slate-700 ring-slate-200/80";
}
