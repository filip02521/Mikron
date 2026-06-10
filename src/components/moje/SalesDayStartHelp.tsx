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

      <HelpBlock title="Kolejność">
        <ol className="list-decimal space-y-1.5 pl-4 text-sm">
          <li>Gotowe na magazynie — najpilniejsze</li>
          <li>Anulowania i informacje do potwierdzenia</li>
          <li>Przypomnienia ZK i notatek</li>
          <li>Odpowiedzi i ogłoszenia od zakupów</li>
        </ol>
      </HelpBlock>

      <HelpBlock title="Przypięty kontekst">
        <p>
          Ogłoszenia od zakupów i Twoje notatki — baza robocza, nie zadania. Kliknij kartę, żeby
          przejść do tablicy, ZK czekających lub wpisu w notatkach.
        </p>
      </HelpBlock>
    </HelpPopover>
  );
}
