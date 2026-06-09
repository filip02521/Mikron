"use client";

import { HelpPopover, GuideIcon } from "@/components/ui/HelpPopover";
import { HelpBlock } from "@/components/ui/HelpBlock";
import { HISTORY_RETENTION_MONTHS } from "@/lib/orders/history-retention";

export function HistoriaHelp() {
  return (
    <HelpPopover
      label="Pomoc — historia zamówień"
      title="Historia zamówień"
      shortLabel="Pomoc"
      icon={<GuideIcon />}
    >
      <HelpBlock title="Lista">
        <p>
          Na ekranie widać kilka ostatnich wpisów. Pełną historię otworzysz przyciskiem „Pokaż
          pełną historię” — z wyszukiwaniem.
        </p>
      </HelpBlock>

      <HelpBlock title="Przechowywanie">
        <p>
          Dane starsze niż {HISTORY_RETENTION_MONTHS} miesięcy są usuwane automatycznie, około
          raz na dobę.
        </p>
      </HelpBlock>
    </HelpPopover>
  );
}
