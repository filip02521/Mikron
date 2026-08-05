"use client";

import { HelpPopover, GuideIcon } from "@/components/ui/HelpPopover";
import { HelpBlock } from "@/components/ui/HelpBlock";
import { pageToolbarSizingClass, pageToolbarSurfaceClass } from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";

export function SalesDayStartHelp() {
  return (
    <HelpPopover
      label="Pomoc — Start dnia"
      title="Start dnia"
      shortLabel="Start dnia"
      icon={<GuideIcon />}
      buttonClassName={cn(pageToolbarSurfaceClass, pageToolbarSizingClass, "px-2.5")}
    >
      <HelpBlock title="Co tu jest">
        <p>
          Jedna kolejka na rano: gotowy towar, uwagi od zakupów przy prośbach, przypomnienia ZK i
          nowości z tablicy — bez skakania między zakładkami.
        </p>
      </HelpBlock>

      <HelpBlock title="Kliknięcie pozycji">
        <p>
          Pozycje z zamówień przewijają listę do właściwej karty. Przy uwagach od zakupów otwórz
          prośbę i potwierdź <strong className="font-medium text-slate-800">Widziałem</strong>, żeby
          sygnał zniknął. Przypomnienia ZK i notatki otwierają odpowiednią stronę. Ogłoszenia
          przewijają do sekcji poniżej.
        </p>
      </HelpBlock>

      <HelpBlock title="Kolejność">
        <ol className="list-decimal space-y-1.5 pl-4 text-sm">
          <li>Gotowe do odbioru z regału — najpilniejsze</li>
          <li>Anulowania i informacje do potwierdzenia</li>
          <li>Uwagi zaktualizowane przez zakupy</li>
          <li>Przypomnienia ZK i notatek</li>
          <li>Odpowiedzi na Tablicy i ogłoszenia na liście poniżej</li>
        </ol>
      </HelpBlock>
    </HelpPopover>
  );
}
