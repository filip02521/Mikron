export function HowItWorksContent() {
  return (
    <ol className="list-decimal space-y-2 pl-4 text-sm leading-relaxed text-slate-600">
      <li>
        <strong className="text-slate-800">Prośby handlowców</strong> — na górze panelu;{" "}
        <strong>Główne</strong> / <strong>Uzupełniające</strong> → realizacja indywidualna.
        Pozycje informacyjne (tylko e-mail) obsługuje dział dostaw w{" "}
        <strong className="text-slate-800">Magazynie i regale</strong>, nie tutaj.
      </li>
      <li>
        <strong className="text-slate-800">Zaległe i na dziś</strong> — oznacz{" "}
        <strong>Zamówione</strong> (pojedynczo lub wiele). Zaległe mają delikatne różowe
        tło, na dziś — standardową białą kartę.
      </li>
      <li>
        <strong className="text-slate-800">Plan tygodnia</strong> — podgląd pon.–pt.;{" "}
        <strong>Tryb planowania</strong> pozwala przeciągnąć dostawców między dniami i
        zatwierdzić cały plan naraz. Na przyszłych terminach też możesz oznaczyć{" "}
        <strong>Zamówione</strong> z wyprzedzeniem. Zaległe i na dziś — w sekcji powyżej.
      </li>
      <li>
        <strong className="text-slate-800">Przesunięcie</strong> —{" "}
        <strong>Przesuń</strong>, gdy dostawca prosi o inną datę.
      </li>
      <li>
        <strong className="text-slate-800">Terminy zamówień</strong> — daty cyklu
        (Polska / Zagranica / Import); karty i urlopy w sekcji Dostawcy.
      </li>
    </ol>
  );
}

/** Zachowane dla ewentualnego użycia poza panelem dziennym. */
export function HowItWorks() {
  return (
    <details className="group rounded-2xl border border-slate-200/90 bg-white shadow-sm open:shadow-md">
      <summary className="cursor-pointer list-none px-6 py-4 text-sm font-semibold text-slate-900 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-2">
          Jak działa panel dzienny?
          <span className="text-slate-400 transition group-open:rotate-180">▾</span>
        </span>
      </summary>
      <div className="border-t border-slate-100 px-6 py-4">
        <HowItWorksContent />
      </div>
    </details>
  );
}
