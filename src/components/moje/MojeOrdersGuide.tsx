"use client";

import { HelpPopover, GuideIcon } from "@/components/ui/HelpPopover";
import { pageToolbarSizingClass } from "@/lib/ui/ontime-theme";
import {
  IconAvailability,
  IconTruck,
} from "@/components/icons/StrokeIcons";
import { HelpMenuGlyph } from "@/components/ui/UiGlyphs";
import {
  INFORMACJA_FLOW_DIRECT,
  INFORMACJA_FLOW_MY_ORDERS_HINT,
} from "@/lib/orders/informacja-flow-copy";

/** Krótka pomoc — szczegóły w popoverze, bez dużego bloku na stronie. */
export function MojeOrdersHelp() {
  return (
    <HelpPopover
      label="Jak to czytać"
      title="Moje zamówienia"
      shortLabel="Pomoc"
      icon={<GuideIcon />}
      buttonClassName={pageToolbarSizingClass}
    >
      <p className="mb-3 text-slate-600">
        Każdy wiersz to jedna prośba u jednego dostawcy. Najpierw patrz na{" "}
        <strong className="font-medium text-slate-800">nagłówek</strong> — mówi, co się dzieje
        i czy musisz coś potwierdzić.
      </p>
      <ol className="mb-3 list-decimal space-y-1.5 pl-4 text-slate-600">
        <li>
          <strong className="font-medium text-slate-800">Nagłówek</strong> — np. odbiór z
          magazynu albo „powiadomimy, gdy przyjedzie”
        </li>
        <li>
          <strong className="font-medium text-slate-800">Status</strong> (pod nagłówkiem) —
          oficjalny etap prośby
        </li>
        <li>
          <strong className="font-medium text-slate-800">Zielony przycisk</strong> — tylko gdy
          trzeba potwierdzić odbiór lub powiadomienie
        </li>
        <li>
          <strong className="font-medium text-slate-800">Menu</strong>{" "}
          <HelpMenuGlyph className="align-[-2px]" /> — klient, poprawka, anulowanie
        </li>
        <li>
          <strong className="font-medium text-slate-800">Strzałka rozwiń</strong> — wiele
          produktów lub dodatkowe szczegóły
        </li>
      </ol>
      <p className="mb-2 flex items-start gap-2">
        <IconTruck size={16} className="mt-0.5 shrink-0 text-slate-500" aria-hidden />
        <span>
          <strong className="font-medium text-slate-800">Zamówienie u dostawcy</strong> — białe
          tło; dział składa zamówienie i informuje o odbiorze.
        </span>
      </p>
      <p className="mb-3 flex items-start gap-2">
        <IconAvailability size={16} className="mt-0.5 shrink-0 text-violet-600" aria-hidden />
        <span>
          <strong className="font-medium text-slate-800">
            {INFORMACJA_FLOW_DIRECT.label}
          </strong>{" "}
          — <span className="font-medium text-violet-800">fioletowe tło</span>; magazyn obserwuje
          dostępność i wysyła e-mail, gdy towar trafi na stan (bez zamówienia u dostawcy).
        </span>
      </p>
      <p className="mb-3 text-xs leading-relaxed text-slate-500">{INFORMACJA_FLOW_MY_ORDERS_HINT}</p>
      <p className="mb-2">
        <strong className="font-medium text-slate-800">Filtry</strong> u góry (
        <em>Do potwierdzenia</em> / <em>W toku</em>) opcjonalnie zawężają listę — np.
        „Odbiór”, gdy czeka wiele prośb.
      </p>
      <p className="mb-2 text-slate-600">
        Sekcja <strong className="font-medium text-slate-800">Do potwierdzenia</strong> na liście
        zbiera prośby z zielonym przyciskiem — reszta jest w sekcjach poniżej.
      </p>
      <p className="text-slate-600">
        Na dole strony — <strong className="font-medium text-slate-800">archiwum</strong>{" "}
        zakończonych prośb.
      </p>
    </HelpPopover>
  );
}
