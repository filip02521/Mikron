import { formatDateString, getMondayOfWeek, toDateOnly } from "./dates";
import { SUMMARY_COLORS } from "@/types/database";

export interface SummaryColorSet {
  expired: string;
  today: string;
  tomorrow: string;
  thisWeek: string;
  forSomeone: string;
  vacationWarning: string;
}

export function getRowColorForDate(
  dateValue: Date | null,
  colors: SummaryColorSet = SUMMARY_COLORS,
  today: Date = toDateOnly(new Date())
): string | null {
  if (!dateValue || isNaN(dateValue.getTime())) return null;

  const todayStr = formatDateString(today);
  const rowDateStr = formatDateString(dateValue);

  if (rowDateStr < todayStr) return colors.expired;
  if (rowDateStr === todayStr) return colors.today;

  const rowDate = toDateOnly(dateValue);
  const diffDays =
    (rowDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays === 1) return colors.tomorrow;

  const monday = getMondayOfWeek(today);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  if (rowDate >= monday && rowDate <= sunday) return colors.thisWeek;
  return null;
}

export function modifyHexColor(hex: string, percent: number): string {
  if (!hex || hex.length < 7) return hex;
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  const amount = Math.round(2.55 * percent);
  r = Math.max(0, Math.min(255, r + amount));
  g = Math.max(0, Math.min(255, g + amount));
  b = Math.max(0, Math.min(255, b + amount));
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function getVacationMessage(
  note: string | null,
  date?: Date | null
): string {
  const dateString = date ? ` (${formatDateString(date, "dd.MM")})` : "";
  switch (note) {
    case "PRZESUNIETE_PO":
      return `Termin przesunięty (urlop)${dateString}`;
    case "PRZYSPIESZONE_PRZED":
      return `Termin przyspieszony (urlop)${dateString}`;
    case "OSTATNIE_ZAMOWIENIE":
      return `OSTATNIE ZAMÓWIENIE PRZED URLOPEM!${dateString}`;
    default:
      return "";
  }
}
