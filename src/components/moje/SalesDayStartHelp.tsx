"use client";

import { HelpPopover, GuideIcon } from "@/components/ui/HelpPopover";
import { HelpBlock } from "@/components/ui/HelpBlock";

export function SalesDayStartHelp() {
  return (
    <HelpPopover
      label="Pomoc — Start dnia"
      title="Start dnia"
      shortLabel="Pomoc"
      icon={<GuideIcon />}
    >
      <HelpBlock title="Co tu jest">
        <p>
          Jedna kolejka na rano: gotowy towar, przypomnienia z notatnika i nowości z tablicy — bez
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

      <HelpBlock title="Przypięte notatki">
        <p>
          To kontekst roboczy — nie zadania. Kliknij kartę, żeby przejść do wpisu w notatniku.
        </p>
      </HelpBlock>
    </HelpPopover>
  );
}
