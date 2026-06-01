"use client";

import { HelpPopover, GuideIcon } from "@/components/ui/HelpPopover";

export function QueuePanelHelp() {
  return (
    <HelpPopover
      label="Jak wpisywać dostawy"
      title="Magazyn i regał"
      shortLabel="Pomoc"
      icon={<GuideIcon />}
    >
      <p>
        <strong>Kolejka przyjęcia</strong> — jedna lista pogrupowana po dostawcy (domyślnie zwinięta).
        Wiersze z zieloną kropką: kliknij ilość zamówioną lub wpisz dostawę, Enter lub ✓.
        Niebieska kropka (informacja): przycisk Powiadom po dotarciu towaru.
        Zaznacz wiele pozycji — pasek akcji u góry tabeli.
      </p>
      <p className="mt-2">
        <strong>Inwentaryzacja regału</strong> — co czeka na odbiór, sortowanie po dostawcy / regale /
        handlowcu, filtry dostawcy. Dostawca przy produkcie; przy częściowej dostawie widać resztę u
        dostawcy. Pozycje ≥3 dni roboczych bez odbioru podświetlamy.
      </p>
    </HelpPopover>
  );
}
