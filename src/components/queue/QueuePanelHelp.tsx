"use client";

import { HelpPopover, GuideIcon } from "@/components/ui/HelpPopover";
import { HelpBlock } from "@/components/ui/HelpBlock";
import { InlineCheck } from "@/components/ui/UiGlyphs";

export function QueuePanelHelp() {
  return (
    <HelpPopover
      label="Pomoc — magazyn i regał"
      title="Przyjęcie towaru"
      shortLabel="Pomoc"
      icon={<GuideIcon />}
    >
      <HelpBlock title="Kolejka przyjęcia">
        <ul className="list-disc space-y-1.5 pl-4">
          <li>Lista pogrupowana po dostawcy (domyślnie zwinięta).</li>
          <li>
            Zielona kropka — wpisz ilość dostawy, potwierdź Enterem lub{" "}
            <InlineCheck size={12} className="align-[-2px]" />.
          </li>
          <li>Niebieska kropka (informacja) — przycisk Powiadom po dotarciu towaru.</li>
          <li>Zaznacz wiele pozycji — pasek akcji u góry tabeli.</li>
        </ul>
      </HelpBlock>

      <HelpBlock title="Dziennik dostaw">
        <ul className="list-disc space-y-1.5 pl-4">
          <li>Fizyczne przyjęcie kuriera — paczki, palety, przewoźnik (niezależnie od linii zamówień).</li>
          <li>
            Zakładki <strong>Dzień</strong> (wpisy z wybranej daty) i <strong>Archiwum</strong> (wyszukiwanie i
            podsumowania) są dostępne dla każdego konta magazynu i zakupów.
          </li>
          <li>Nowe wpisy dodaje magazyn — tylko na bieżący dzień.</li>
        </ul>
      </HelpBlock>

      <HelpBlock title="Inwentaryzacja regału">
        <ul className="list-disc space-y-1.5 pl-4">
          <li>Towar czekający na odbiór — sortowanie po dostawcy, regale albo handlowcu.</li>
          <li>Przy częściowej dostawie widać resztę u dostawcy.</li>
          <li>Pozycje ≥3 dni roboczych bez odbioru są podświetlone.</li>
        </ul>
      </HelpBlock>
    </HelpPopover>
  );
}
