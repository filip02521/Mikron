"use client";

import { HelpPopover } from "@/components/ui/HelpPopover";

/** Krótka pomoc — szczegóły w popoverze, bez dużego bloku na stronie. */
export function MojeOrdersHelp() {
  return (
    <HelpPopover label="Jak to czytać" title="Moje zamówienia" shortLabel="Pomoc">
      <p className="mb-2">
        <strong className="font-medium text-slate-800">Wiersz</strong> — dostawca, status i
        produkty. Rozwiń po szczegóły, poprawę lub wycofanie prośby.
      </p>
      <p className="mb-2">
        <strong className="font-medium text-slate-800">Zielony / „Odbiór”</strong> — towar na
        magazynie; potwierdź, gdy go odbierzesz.
      </p>
      <p>
        <strong className="font-medium text-slate-800">Filtry</strong> u góry listy — opcjonalnie
        zawężają widok. Na dole — archiwum zakończonych prośb.
      </p>
    </HelpPopover>
  );
}
