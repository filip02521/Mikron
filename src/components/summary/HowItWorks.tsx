import { HelpBlock } from "@/components/ui/HelpBlock";
import { FlowSteps, HelpMenuGlyph } from "@/components/ui/UiGlyphs";

export function HowItWorksContent() {
  return (
    <>
      <HelpBlock title="Zakładki">
        <ul className="list-disc space-y-1.5 pl-4">
          <li>
            <strong className="font-medium text-slate-800">Dziś</strong> - kolejka:{" "}
            <FlowSteps
              steps={["dostawcy na dziś", "brak na stanie", "prośby"]}
              chevronClassName="text-indigo-300"
            />
            . Pasek postępu sumuje harmonogram i prośby.
          </li>
          <li>
            <strong className="font-medium text-slate-800">Tydzień</strong> - plan pon.-pt. z
            kartami dostawców.
          </li>
          <li>
            <strong className="font-medium text-slate-800">Wyjątki</strong> - rezygnacje
            handlowców, prośby informacyjne, dostawcy na żądanie i poza harmonogramem.
          </li>
        </ul>
      </HelpBlock>

      <HelpBlock title="Dostawcy na dziś">
        <p>
          Każdy dostawca ma jeden wiersz, także gdy jest w automacie i w harmonogramie naraz. Grupa mówi, co zrobić, a
          przycisk w wierszu to robi:
        </p>
        <ul className="mt-1.5 list-disc space-y-1.5 pl-4">
          <li>
            <strong className="font-medium text-slate-800">Do wysłania</strong> - automat przygotował zamówienie:{" "}
            <strong className="font-medium text-slate-800">Sprawdź i wyślij</strong>.
          </li>
          <li>
            <strong className="font-medium text-slate-800">Do zamówienia</strong> - analiza Braki albo prośby handlowców
            mówią „zamów”: <strong className="font-medium text-slate-800">Przygotuj ZD</strong> otwiera Kreator.
          </li>
          <li>
            <strong className="font-medium text-slate-800">Zamów wcześniej</strong> - dostawcy poza planem, u których
            zapas nie wystarczy do planowego zamówienia; najpilniejsi są na górze.
          </li>
          <li>
            <strong className="font-medium text-slate-800">Do przesunięcia</strong> - termin wypada dziś, a stan
            wystarcza: <strong className="font-medium text-slate-800">Przesuń</strong>.
          </li>
          <li>
            <strong className="font-medium text-slate-800">Do sprawdzenia ręcznie</strong> - brak aktualnej analizy
            albo urlop dostawcy; po złożeniu zamówienia kliknij{" "}
            <strong className="font-medium text-slate-800">Zamówione</strong>.
          </li>
          <li>
            Strzałka przy nazwie rozwija szczegóły i pozostałe akcje (menu{" "}
            <HelpMenuGlyph className="align-[-2px]" /> - urlop i edycja karty). Chipy nad listą filtrują po źródle:
            Automat, Harmonogram, Poza planem, Na żądanie.
          </li>
        </ul>
      </HelpBlock>

      <HelpBlock title="Prośby handlowców">
        <p>
          Oznacz prośbę jako <strong className="font-medium text-slate-800">Główne</strong> albo{" "}
          <strong className="font-medium text-slate-800">Uzupełniające</strong> - potem trafi do
          magazynu lub kolejki informacji.
        </p>
      </HelpBlock>

      <HelpBlock title="Plan tygodnia">
        <ul className="list-disc space-y-1.5 pl-4">
          <li>Te same akcje co na zakładce Dziś - na kartach z przyszłymi terminami.</li>
          <li>
            <strong className="font-medium text-slate-800">Tryb planowania</strong> - przeciągnij
            karty między dniami, potem <strong className="font-medium text-slate-800">Zatwierdź plan</strong>.
          </li>
        </ul>
      </HelpBlock>

      <HelpBlock title="Skróty i menu">
        <p>
          Wyszukiwarka{" "}
          <kbd className="rounded border border-slate-200 bg-slate-50 px-1 font-mono text-[0.6875rem]">
            /
          </kbd>
          , nowa prośba i menu <HelpMenuGlyph className="align-[-2px]" /> są u góry karty. Pełna
          lista skrótów - przycisk Skróty przy tytule.
        </p>
      </HelpBlock>

      <HelpBlock title="Cofnięcie i odświeżanie">
        <ul className="list-disc space-y-1.5 pl-4">
          <li>Po każdej zmianie masz 10 sekund na cofnięcie.</li>
          <li>
            Pod zakładkami widać, kiedy panel sprawdzał kolejkę. Włącz{" "}
            <strong className="font-medium text-slate-800">Auto przy zmianach</strong>, aby widok
            odświeżał się sam co ok. 3 min.
          </li>
        </ul>
      </HelpBlock>
    </>
  );
}

/** Zachowane dla ewentualnego użycia poza panelem dziennym. */
export function HowItWorks() {
  return (
    <details className="group rounded-lg border border-slate-200/90 bg-card shadow-sm open:shadow-md">
      <summary className="cursor-pointer list-none px-6 py-4 text-sm font-semibold text-slate-900 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-2">
          Jak działa panel dzienny?
          <span className="text-xs font-medium text-slate-400 group-open:hidden">Rozwiń</span>
          <span className="hidden text-xs font-medium text-slate-400 group-open:inline">
            Zwiń
          </span>
        </span>
      </summary>
      <div className="border-t border-slate-100 px-6 py-4">
        <HowItWorksContent />
      </div>
    </details>
  );
}
