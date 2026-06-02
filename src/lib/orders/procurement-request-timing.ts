import { formatPlDate } from "@/lib/display-labels";
import { formatDateString } from "@/lib/orders/dates";
import { todayInWarsaw, warsawDateKeyFromIso, warsawNowParts } from "@/lib/time/warsaw";
import { subDays } from "date-fns";

const TZ = "Europe/Warsaw";

const warsawTimeFormatter = new Intl.DateTimeFormat("pl-PL", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Godzina zgłoszenia w strefie Europe/Warsaw (np. 14:32). */
export function formatWarsawTime(iso: string): string {
  return warsawTimeFormatter.format(new Date(iso));
}

/** Czy ISO to sama data (bez godziny) — stare rekordy / import. */
export function isDateOnlyTimestamp(iso: string): boolean {
  const trimmed = iso.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
}

/** Czytelna etykieta daty i godziny zgłoszenia prośby (dziś / wczoraj / dd.MM.yyyy). */
export function formatProcurementSubmittedLabel(
  iso: string,
  at: Date = new Date()
): string {
  const dateKey = warsawDateKeyFromIso(iso);
  const todayKey = warsawNowParts(at).dateKey;

  if (isDateOnlyTimestamp(iso)) {
    if (dateKey === todayKey) return "dziś";
    const yesterdayKey = formatDateString(subDays(todayInWarsaw(at), 1));
    if (dateKey === yesterdayKey) return "wczoraj";
    return formatPlDate(dateKey);
  }

  const time = formatWarsawTime(iso);

  if (dateKey === todayKey) return `dziś ${time}`;

  const yesterdayKey = formatDateString(subDays(todayInWarsaw(at), 1));
  if (dateKey === yesterdayKey) return `wczoraj ${time}`;

  return `${formatPlDate(dateKey)} ${time}`;
}

/** Zakres zgłoszeń w grupie (wiele produktów w różnych momentach). */
export function formatProcurementGroupSubmittedLabel(
  earliestIso: string,
  latestIso: string,
  at: Date = new Date()
): string {
  if (earliestIso === latestIso) {
    return formatProcurementSubmittedLabel(earliestIso, at);
  }

  const earliestDate = warsawDateKeyFromIso(earliestIso);
  const latestDate = warsawDateKeyFromIso(latestIso);

  if (earliestDate === latestDate) {
    if (isDateOnlyTimestamp(earliestIso) && isDateOnlyTimestamp(latestIso)) {
      return formatProcurementSubmittedLabel(earliestIso, at);
    }
    const dayPart = formatProcurementSubmittedLabel(earliestIso, at).replace(
      / \d{1,2}:\d{2}$/,
      ""
    );
    return `${dayPart} ${formatWarsawTime(earliestIso)}–${formatWarsawTime(latestIso)}`;
  }

  return `od ${formatProcurementSubmittedLabel(earliestIso, at)} do ${formatProcurementSubmittedLabel(latestIso, at)}`;
}

export function compareProcurementSubmittedAt(a: string, b: string): number {
  return new Date(a).getTime() - new Date(b).getTime();
}
