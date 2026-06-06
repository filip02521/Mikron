import { FlowSteps, HelpMenuGlyph } from "@/components/ui/UiGlyphs";

export function HowItWorksContent() {
  return (
    <ol className="list-decimal space-y-2 pl-4 text-sm leading-relaxed text-slate-600">
      <li>
        <strong className="text-slate-800">Dziś</strong> — kolejka:{" "}
        <FlowSteps
          steps={["zaległe", "prośby", "na dziś"]}
          chevronClassName="text-indigo-300"
        />
        . Pasek postępu sumuje harmonogram i prośby.
      </li>
      <li>
        <strong className="text-slate-800">Tydzień</strong> — plan pon.–pt., to samo kliknięcie{" "}
        <strong>Zamówione</strong> na kartach. <strong>Tryb planowania</strong> — przeciągnij i{" "}
        <strong>Zatwierdź plan</strong>.
      </li>
      <li>
        <strong className="text-slate-800">Wyjątki</strong> — rezygnacje handlowców, prośby
        tylko o informację, dostawcy na żądanie i poza harmonogramem.
      </li>
      <li>
        Skróty panelu (wyszukiwarka{" "}
        <kbd className="rounded border border-slate-200 bg-slate-50 px-1 font-mono text-[11px]">
          /
        </kbd>
        , nowa prośba, menu <HelpMenuGlyph className="align-[-2px]" />) są zawsze u góry karty.
      </li>
      <li>
        <strong className="text-slate-800">Harmonogram</strong> —{" "}
        <strong>Przesuń</strong> przy zmianie daty u dostawcy; menu Więcej (
        <HelpMenuGlyph className="align-[-2px]" />) — urlop i edycja.
      </li>
      <li>
        Po każdej zmianie masz <strong>5 sekund na cofnięcie</strong>.
      </li>
    </ol>
  );
}

/** Zachowane dla ewentualnego użycia poza panelem dziennym. */
export function HowItWorks() {
  return (
    <details className="group rounded-lg border border-slate-200/90 bg-white shadow-sm open:shadow-md">
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
