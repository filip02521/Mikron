"use client";

import { HelpPopover } from "@/components/ui/HelpPopover";
import { HelpBlock } from "@/components/ui/HelpBlock";
import { KeyboardShortcutsHint } from "@/components/ui/KeyboardShortcutsHint";
import { Kbd } from "@/components/ui/Kbd";
import { PanelQueueStatDot } from "@/components/ui/UiGlyphs";
import { ProductSourceBadge } from "@/components/orders/ProductSourceBadge";
import {
  INFORMACJA_STOCK_OUT_PANEL_BADGE,
  INFORMACJA_VIA_PANEL_BADGE,
} from "@/lib/orders/informacja-flow-copy";

const FOR_SOMEONE_KEYBOARD_HINTS = [
  { keys: ["↑", "↓"], label: "grupy" },
  { keys: ["Enter"], label: "produkty" },
  { keys: ["Shift", "G"], label: "główne" },
  { keys: ["Shift", "U"], label: "uzupełniające" },
  { keys: ["E"], label: "edycja" },
  { keys: ["/"], label: "wyszukaj dostawcę (panel)" },
  { keys: ["Ctrl", "Z"], label: "cofnij" },
] as const;

export function StockOutSectionHelp() {
  return (
    <HelpPopover label="Pomoc — brak na stanie" title="Brak na stanie" shortLabel="Pomoc">
      <HelpBlock title="Co tu jest">
        <p className="inline-flex flex-wrap items-center gap-1.5">
          <PanelQueueStatDot tone="stockOut" />
          <span>
            Sygnały, że towar skończył się na magazynie — to nie prośby klientów. Handlowiec nie
            śledzi tych pozycji w Moje zamówienia.
          </span>
        </p>
      </HelpBlock>

      <HelpBlock title="Główne i uzupełniające">
        <ul className="list-disc space-y-1.5 pl-4">
          <li>
            <strong className="font-medium text-slate-800">Główne</strong> — zamówienie w planie
            dostawcy.
          </li>
          <li>
            <strong className="font-medium text-slate-800">Uzupełniające</strong> — poza planem.
          </li>
          <li>Po Główne pozycja znika z tej listy.</li>
        </ul>
      </HelpBlock>

      <HelpBlock title="Oznaczenia">
        <p>
          Badge{" "}
          <strong className="font-medium text-amber-800">{INFORMACJA_STOCK_OUT_PANEL_BADGE}</strong>{" "}
          — w prawym górnym rogu wiersza (bez powtórzenia przy produkcie).
        </p>
      </HelpBlock>
      <HelpBlock title="Szczegóły dostawcy">
        <p>
          Kliknij nazwę dostawcy (pod produktem albo w tytule przy wielu pozycjach). W bloku kilku
          osób — nazwę w nagłówku bloku. Albo „Szczegóły dostawcy” w menu ⋮.
        </p>
      </HelpBlock>
      <HelpBlock title="Flagi">
        <p>
          Opcjonalne etykiety na wierszu (menu ⋮) — bez osobnych torów i filtrów. Ta sekcja to jedna
          płaska lista sygnałów.
        </p>
      </HelpBlock>
    </HelpPopover>
  );
}

export function ForSomeoneRequestsSectionHelp() {
  return (
    <HelpPopover label="Pomoc — prośby handlowców" title="Prośby handlowców" shortLabel="Pomoc">
      <HelpBlock title="Główne i uzupełniające">
        <ul className="list-disc space-y-1.5 pl-4">
          <li>
            <strong className="font-medium text-slate-800">Główne</strong> — zamówienie w planie
            dostawcy.
          </li>
          <li>
            <strong className="font-medium text-slate-800">Uzupełniające</strong> — osobne
            domówienie poza planem.
          </li>
          <li>
            U dostawcy <strong className="font-medium text-slate-800">na żądanie</strong> —
            przycisk <strong className="font-medium text-slate-800">Główne (bez terminu)</strong>:
            prośba jest główna, ale harmonogram tygodnia się nie przesuwa.
          </li>
        </ul>
      </HelpBlock>

      <HelpBlock title="Obsługa wiersza">
        <ul className="list-disc space-y-1.5 pl-4">
          <li>Na komputerze — przyciski Główne / Uzupełniające po najechaniu na wiersz.</li>
          <li>Na tablecie i telefonie — przyciski widoczne cały czas.</li>
          <li>
            Produkty: jeden w wierszu, więcej — przycisk „Produkty”. Zwinięty blok dostawcy nie
            jest w nawigacji klawiaturą.
          </li>
        </ul>
      </HelpBlock>

      <HelpBlock title="Skróty klawiszowe">
        <p className="mb-2">
          <Kbd>Shift</Kbd>+<Kbd>G</Kbd> / <Kbd>Shift</Kbd>+<Kbd>U</Kbd> na zaznaczonej grupie,{" "}
          <Kbd>↑</Kbd>/<Kbd>↓</Kbd> między grupami.
        </p>
        <KeyboardShortcutsHint items={[...FOR_SOMEONE_KEYBOARD_HINTS]} />
      </HelpBlock>

      <HelpBlock title="Tory (organizacja kolejki)">
        <ul className="list-disc space-y-1.5 pl-4">
          <li>
            Prośby są w torach: <strong className="font-medium text-slate-800">Do rozdzielenia</strong>{" "}
            (jeszcze nieprzeczytane), potem <strong className="font-medium text-slate-800">osobny tor
            na każdą flagę</strong> (kolor z Zarządzaj), potem{" "}
            <strong className="font-medium text-slate-800">Do zamówienia</strong>, Magazyn→info, Urlop.
          </li>
          <li>
            <strong className="font-medium text-slate-800">Tor ustawia się po fladze</strong> — nie
            przesuwasz ręcznie. Menu „Więcej → Flaga: …”, chip albo edytor flagi zapisuje oznaczenie;
            prośba od razu pojawia się w <em>osobnym torze tej flagi</em> (kolor tła = kolor flagi
            z Zarządzaj).
          </li>
          <li>
            <strong className="font-medium text-slate-800">Wyczyść flagę</strong> wraca do reguł
            systemowych (Do rozdzielenia / Do zamówienia / Urlop / Magazyn→info).
          </li>
          <li>
            Badge <strong className="font-medium text-violet-800">Nowa</strong> znika po najechaniu —
            to nie przenosi od razu z „Do rozdzielenia” (dopiero po odświeżeniu danych z serwera).
          </li>
          <li>
            „Zamów razem” działa tylko dla osób w <em>tym samym</em> torze u dostawcy.
          </li>
        </ul>
      </HelpBlock>

      <HelpBlock title="Oznaczenia">
        <ul className="list-disc space-y-1.5 pl-4">
          <li>
            Tytuł wiersza to zawsze <strong className="font-medium text-slate-800">dostawca</strong>
            (w bloku wielu osób — handlowiec, bo dostawca jest w nagłówku bloku); pod nim pas
            sygnałów: Nowa → Urlop → flaga.
          </li>
          <li>
            Badge <strong className="font-medium text-indigo-800">{INFORMACJA_VIA_PANEL_BADGE}</strong>{" "}
            — po prawej tylko przy wyjątku Informacji przez panel; w torze „Magazyn → info” gdy bez
            silniejszej flagi.
          </li>
          <li>
            Chip <strong className="font-medium text-amber-900">Urlop</strong> — na nagłówku bloku
            dostawcy albo w wierszu. Zakres dat w tooltipie — to nie jest flaga zakupów.
          </li>
          <li>
            Kolorowe chipy flag — oznaczenia zakupów. Kolejność <strong className="font-medium text-slate-800">wszystkich torów</strong> (także Do zamówienia / Urlop): strzałki ↑↓ na nagłówku toru albo w „Zarządzaj” dla flag. Handlowiec flag nie widzi.
          </li>
          <li className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
            Przy produkcie: <ProductSourceBadge fromSubiekt size={12} className="size-5" /> — z
            bazy Subiekt; <ProductSourceBadge fromSubiekt={false} size={12} className="size-5" /> —
            wpis ręczny.
          </li>
        </ul>
      </HelpBlock>

      <HelpBlock title="Wielu handlowców u dostawcy">
        <p>
          Użyj <strong className="font-medium text-slate-800">Zamów razem</strong> (wszyscy w tym
          torze) albo <strong className="font-medium text-slate-800">Tylko ta osoba</strong> w
          wierszu. Przy trzech i więcej osobach lista domyślnie jest zwinięta — rozwija się, gdy
          pojawi się badge Nowa.
        </p>
      </HelpBlock>
    </HelpPopover>
  );
}
