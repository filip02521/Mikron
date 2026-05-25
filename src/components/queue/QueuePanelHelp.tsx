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
        Przy rezygnacji widać decyzję zakupów (stan lub zwrot).
      </p>
      <p className="mt-2">
        <strong>Informacje</strong> — tylko e-mail po dotarciu towaru (bez kolejki dostaw). Przy
        wielu pozycjach naraz wysyłamy <strong>jeden e-mail na handlowca</strong>.
      </p>
    </HelpPopover>
  );
}
