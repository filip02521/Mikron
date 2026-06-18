"use client";

import { HelpPopover, GuideIcon } from "@/components/ui/HelpPopover";
import { HelpBlock } from "@/components/ui/HelpBlock";
import { HelpMenuGlyph } from "@/components/ui/UiGlyphs";
import { cn } from "@/lib/cn";
import { pageToolbarSizingClass, pageToolbarSurfaceClass } from "@/lib/ui/ontime-theme";
import { INFORMACJA_FLOW_DIRECT } from "@/lib/orders/informacja-flow-copy";
import {
  MY_ORDER_ACTION_SECTION_COPY,
  MY_ORDER_INFORMACJA_SECTION_COPY,
  MY_ORDER_PROGRESS_SECTION_COPY,
} from "@/lib/orders/my-order-inbox-sections";

/** Krótka pomoc — szczegóły w popoverze, bez dużego bloku na stronie. */
export function MojeOrdersHelp() {
  const sections = [
    MY_ORDER_ACTION_SECTION_COPY,
    MY_ORDER_PROGRESS_SECTION_COPY.ordered_progress,
    MY_ORDER_PROGRESS_SECTION_COPY.before_order,
    {
      title: MY_ORDER_INFORMACJA_SECTION_COPY.title,
      hint: MY_ORDER_INFORMACJA_SECTION_COPY.hint,
    },
  ] as const;

  return (
    <HelpPopover
      label="Pomoc — jak czytać listę Moje zamówienia"
      title="Moje zamówienia"
      shortLabel="Lista"
      icon={<GuideIcon />}
      buttonClassName={cn(pageToolbarSurfaceClass, pageToolbarSizingClass, "px-2.5")}
    >
      <HelpBlock title="Co tu jest">
        <p>
          U góry strony <strong className="font-medium text-slate-800">Start dnia</strong> — jedna
          kolejka: gotowy towar, przypomnienia ZK i tablica. Poniżej pełna lista prośb u
          dostawców.
        </p>
      </HelpBlock>

      <HelpBlock title="Sekcje listy (od góry)">
        <ol className="list-decimal space-y-2 pl-4">
          {sections.map((section) => (
            <li key={section.title}>
              <strong className="font-medium text-slate-800">{section.title}</strong>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{section.hint}</p>
            </li>
          ))}
        </ol>
      </HelpBlock>

      <HelpBlock title="Elementy wiersza">
        <ul className="list-disc space-y-1.5 pl-4">
          <li>
            <strong className="font-medium text-slate-800">Nagłówek</strong> — etap prośby w
            prostym języku
          </li>
          <li>
            <strong className="font-medium text-slate-800">Zielony przycisk</strong> — potwierdź
            odbiór, informację od magazynu albo anulowanie
          </li>
          <li>
            <strong className="font-medium text-slate-800">Anuluj</strong> — dyskretny link po
            prawej przy linii; wycofuje całą pozycję
          </li>
          <li>
            <strong className="font-medium text-slate-800">Zmień ilość</strong> — częściowe
            wycofanie sztuk (reszta zostaje w prośbie); przy jednym produkcie także w menu{" "}
            <HelpMenuGlyph className="align-[-2px]" />
          </li>
          <li>
            <strong className="font-medium text-slate-800">Menu</strong>{" "}
            <HelpMenuGlyph className="align-[-2px]" /> — klient, edycja prośby, anulowanie całej
            grupy lub zmiana ilości (jedna pozycja)
          </li>
          <li>
            <strong className="font-medium text-slate-800">Cofnij</strong> — po anulowaniu,
            odbiorze lub ukryciu masz kilka sekund na cofnięcie (toast u dołu ekranu lub skrót
            klawiszowy)
          </li>
          <li>
            <strong className="font-medium text-slate-800">Rozwiń</strong> — produkty i dodatkowe
            szczegóły
          </li>
        </ul>
      </HelpBlock>

      <HelpBlock title="Rodzaje prośb">
        <ul className="list-disc space-y-1.5 pl-4">
          <li>
            <strong className="font-medium text-slate-800">Zamówienie u dostawcy</strong> — zwykły
            wiersz, bez dodatkowego oznaczenia.
          </li>
          <li>
            <strong className="font-medium text-slate-800">{INFORMACJA_FLOW_DIRECT.label}</strong> —
            badge <strong className="font-medium text-violet-900">Informacyjna</strong>, fioletowa
            krawędź wiersza; magazyn czeka na towar i wysyła e-mail po przyjęciu. Prośby „Brak na
            stanie” nie trafiają tutaj — obsługuje je dział zakupów.
          </li>
        </ul>
      </HelpBlock>

      <HelpBlock title="Sekcje listy">
        <p>
          Prośby są podzielone na sekcje —{" "}
          <strong className="font-medium text-emerald-900">Wymaga reakcji</strong> u góry, potem
          zamówienia u dostawcy i informacje o dostępności. Start dnia przewinie Cię do właściwej
          sekcji.
        </p>
      </HelpBlock>

      <HelpBlock title="Archiwum">
        <p>Zakończone prośby są na dole strony.</p>
      </HelpBlock>
    </HelpPopover>
  );
}
