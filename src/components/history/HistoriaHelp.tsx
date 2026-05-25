"use client";

import { HelpPopover, GuideIcon } from "@/components/ui/HelpPopover";
import { HISTORY_RETENTION_MONTHS } from "@/lib/orders/history-retention";

export function HistoriaHelp() {
  return (
    <HelpPopover
      label="O historii"
      title="Historia zamówień"
      shortLabel="Pomoc"
      icon={<GuideIcon />}
    >
      <p>
        Na liście widać kilka ostatnich wpisów. Pełną listę otworzysz przyciskiem „Pokaż pełną
        historię” — z wyszukiwaniem.
      </p>
      <p className="mt-2">
        Dane starsze niż {HISTORY_RETENTION_MONTHS} miesięcy są usuwane automatycznie (ok. raz na
        dobę) — bez crona na serwerze.
      </p>
    </HelpPopover>
  );
}
