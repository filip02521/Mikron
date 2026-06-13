"use client";

import { HelpPopover, GuideIcon } from "@/components/ui/HelpPopover";
import { HelpBlock } from "@/components/ui/HelpBlock";
import { HISTORY_PREVIEW_COUNT, HISTORY_RETENTION_MONTHS } from "@/lib/orders/history-retention";

export function HistoriaHelp() {
  return (
    <HelpPopover
      label="Pomoc — historia zamówień"
      title="Historia zamówień"
      shortLabel="Pomoc"
      icon={<GuideIcon />}
    >
      <HelpBlock title="Dwie sekcje">
        <p>
          <strong>Indywidualna</strong> — zrealizowane prośby handlowców (bez samych
          informacji). <strong>Standardowa</strong> — kliknięcia „Zamówione” i przesunięcia
          terminów z panelu dziennego.
        </p>
      </HelpBlock>

      <HelpBlock title="Lista i wyszukiwanie">
        <p>
          Na ekranie widać {HISTORY_PREVIEW_COUNT} najnowszych wpisów w każdej sekcji. Pełną
          historię otworzysz przyciskiem „Pokaż pełną historię” — z filtrem tekstowym.
        </p>
      </HelpBlock>

      <HelpBlock title="Przechowywanie">
        <p>
          Dane starsze niż {HISTORY_RETENTION_MONTHS} miesięcy są usuwane automatycznie, około
          raz na dobę.
        </p>
      </HelpBlock>

      <HelpBlock title="Administrator">
        <p>Administrator może ręcznie usunąć pojedynczy wpis — np. po błędnym imporcie.</p>
      </HelpBlock>
    </HelpPopover>
  );
}
