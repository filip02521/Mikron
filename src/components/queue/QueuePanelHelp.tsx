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
        <strong>Dostawy dla handlowców</strong> — gdy towar fizycznie przyszedł, wpisz ilość w
        kolumnie „Dost.” i zapisz (lub <strong>Całość</strong>). Handlowiec dostaje powiadomienie.
        Filtruj listę <strong>chipem dostawcy</strong> — te same grupy co w arkuszu. Przy częściowej
        dostawie badge pokazuje, ile sztuk jest już na regale.
      </p>
      <p className="mt-2">
        <strong>Informacje</strong> — tylko e-mail po dotarciu towaru (bez kolejki dostaw). Przy
        wielu pozycjach naraz wysyłamy <strong>jeden e-mail na handlowca</strong>.
      </p>
      <p className="mt-2">
        <strong>Inwentaryzacja regału</strong> — co czeka na odbiór, sortowanie po dostawcy / regale /
        handlowcu, filtry dostawcy. Dostawca przy produkcie; przy częściowej dostawie widać resztę u
        dostawcy. Pozycje ≥3 dni roboczych bez odbioru podświetlamy.
      </p>
    </HelpPopover>
  );
}
