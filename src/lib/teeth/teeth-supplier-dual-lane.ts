import { formatPlDate } from "@/lib/display-labels";
import { DAY_OF_WEEK_LABELS } from "@/lib/data/teeth-schedule";
import type { TeethSupplierLaneSnapshot } from "@/lib/data/teeth-schedule";
import { plCoTydzien } from "@/lib/ui/polish-plurals";

export const TEETH_DUAL_LANE_COPY = {
  dailyPanelScheduleCaption: "Harmonogram panelu dziennego (towar ogólny)",
  dailyPanelNoticeTitle: "Osobny cykl zamówień zębów",
  dailyPanelNoticeBody:
    "Ten dostawca ma niezależny harmonogram w panelu zębów. Daty poniżej dotyczą tylko panelu dziennego — nie mieszają się z cyklem zębów.",
  harmonogramBannerTitle: "Tylko cykl zębów",
  harmonogramBannerBody:
    "Harmonogramy tutaj nie wpływają na terminy w panelu dziennym i odwrotnie. Każdy tor ma własne „oznacz zamówione” i własną historię.",
  teethCycleMetaPrefix: "Cykl zębów",
} as const;

export function teethSupplierCardsHref(): string {
  return "/zakupy/dostawcy?tor=zeby";
}

export function teethPanelKolejkaHref(supplierId?: string | null): string {
  if (!supplierId) return "/zeby/kolejka";
  return `/zeby/kolejka?dostawca=${encodeURIComponent(supplierId)}`;
}

/** Krótka etykieta następnego cyklu zębów (nagłówki w /zeby). */
export function formatTeethLaneScheduleMeta(
  lane: Pick<TeethSupplierLaneSnapshot, "computedNextDate" | "shiftDate">
): string | null {
  if (!lane.computedNextDate) return null;
  const formatted = formatPlDate(lane.computedNextDate);
  if (lane.shiftDate && lane.shiftDate !== lane.computedNextDate) {
    return `${TEETH_DUAL_LANE_COPY.teethCycleMetaPrefix} ${formatted} (przesunięty)`;
  }
  return `${TEETH_DUAL_LANE_COPY.teethCycleMetaPrefix} ${formatted}`;
}

/** Opis cyklu zębów w panelu dziennym (szuflada dostawcy). */
export function describeTeethLaneForDailyPanel(
  lane: TeethSupplierLaneSnapshot
): { primary: string; secondary?: string } {
  const parts: string[] = [];
  if (lane.computedNextDate) {
    parts.push(`Następne zamówienie zębów: ${formatPlDate(lane.computedNextDate)}`);
  } else {
    parts.push("Harmonogram zębów bez wyliczonej daty");
  }

  const rhythm: string[] = [];
  if (lane.orderDayOfWeek != null) {
    rhythm.push(DAY_OF_WEEK_LABELS[lane.orderDayOfWeek] ?? "");
  }
  if (lane.intervalWeeks != null && lane.intervalWeeks > 0) {
    rhythm.push(plCoTydzien(lane.intervalWeeks));
  }
  if (lane.lastOrderDate) {
    rhythm.push(`ostatnio ${formatPlDate(lane.lastOrderDate)}`);
  }

  return {
    primary: parts.join(""),
    secondary: rhythm.filter(Boolean).join(" · ") || undefined,
  };
}

export function teethLaneIndexToRecord(
  index: Map<string, TeethSupplierLaneSnapshot>
): Record<string, TeethSupplierLaneSnapshot> {
  return Object.fromEntries(index);
}
