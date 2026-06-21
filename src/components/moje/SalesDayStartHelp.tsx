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
          Jedna kolejka na rano: gotowy towar, przypomnienia ZK i nowości z tablicy — bez
          skakania między zakładkami.
        </p>
      </HelpBlock>

      <HelpBlock title="Kliknięcie zadania">
        <p>
          Pozycje z zamówień przewijają listę do sekcji{" "}
          <strong className="font-medium text-slate-800">Potwierdź odbiór z regału</strong> i podświetlają ją.
          Przypomnienia ZK, notatki i tablica otwierają odpowiednią stronę.
        </p>
      </HelpBlock>

      <HelpBlock title="Kolejność">
        <ol className="list-decimal space-y-1.5 pl-4 text-sm">
          <li>Gotowe do odbioru z regału — najpilniejsze</li>
          <li>Anulowania i informacje do potwierdzenia</li>
          <li>Przypomnienia ZK i notatek</li>
          <li>Odpowiedzi i ogłoszenia od zakupów</li>
        </ol>
      </HelpBlock>
    </HelpPopover>
  );
}
