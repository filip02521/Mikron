"use client";

import { IconClock } from "@/components/icons/StrokeIcons";
import { PageAttentionStrip, PageAttentionStripCta } from "@/components/ui/PageAttentionStrip";
import { useAppShellMetrics } from "@/components/layout/AppShellMetricsContext";
import { polishPlural } from "@/lib/email/polish-plural";

/**
 * Zamienniki po terminie zwrotu — pasek na zakładkach serwisu (ta sama rodzina co „otwarte pytania”).
 * Liczba z metryk powłoki (ten sam licznik co odznaka przy „Serwis” w menu). Na tablicy zamienników
 * nie pokazujemy go — tam te egzemplarze są w pasie „Do zrobienia”.
 */
export function ServiceOverdueLoanersNotice() {
  const count = useAppShellMetrics().navBadges.serviceOverdueLoaners ?? 0;
  if (count <= 0) return null;
  return (
    <PageAttentionStrip
      tone="amber"
      icon={<IconClock size={17} strokeWidth={2.25} />}
      title={`${polishPlural(count, "zamiennik", "zamienniki", "zamienników")} po terminie zwrotu`}
      hint="Zadzwoń do klienta: przyjmij zwrot albo przedłuż termin w panelu egzemplarza."
      actions={<PageAttentionStripCta href="/serwis/zamienniki">Sprzęt zastępczy</PageAttentionStripCta>}
    />
  );
}
