"use client";

import Link from "next/link";
import { brandLinkClass } from "@/lib/ui/ontime-theme";

type SalesAdminHelpPanelProps = {
  managerMode?: boolean;
};

/** Zwijany przewodnik — zaproszenia, grupy i powiązanie z Kontami. */
export function SalesAdminHelpPanel({ managerMode = false }: SalesAdminHelpPanelProps) {
  return (
    <details className="group overflow-hidden rounded-md border border-slate-200/90 bg-white shadow-sm open:shadow-md">
      <summary className="cursor-pointer list-none px-3 py-3 text-sm font-semibold text-slate-900 marker:content-none sm:px-4 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-2">
          <span>Jak działają karty i konta</span>
          <span className="text-slate-400 transition group-open:rotate-180">▾</span>
        </span>
      </summary>
      <div className="space-y-3 border-t border-slate-100 px-3 pb-4 pt-3 text-sm leading-relaxed text-slate-600 sm:px-4">
        {managerMode ? (
          <>
            <p>
              Dodajesz handlowca ze swojego zakresu grup. System tworzy kartę i konto z hasłem
              jednorazowym — przekaż je osobiście. Przy pierwszym logowaniu użytkownik ustawi własne
              hasło.
            </p>
            <p>
              Dla istniejących kont użyj <strong className="font-medium text-slate-800">Reset hasła</strong>
              . Bez konta możesz wygenerować link zaproszenia.
            </p>
          </>
        ) : (
          <>
            <p>
              <strong className="font-medium text-slate-800">Karta handlowca</strong> to osoba w
              systemie (powiadomienia, Moje zamówienia).{" "}
              <strong className="font-medium text-slate-800">Konto logowania</strong> zakładasz osobno
              — najwygodniej linkiem zaproszenia.
            </p>
            <ol className="list-inside list-decimal space-y-1.5 pl-0.5">
              <li>
                Utwórz grupę (np. Sklep, Biuro) w{" "}
                <Link href="/zespol/grupy" className={brandLinkClass}>
                  Grupy zespołu
                </Link>
                .
              </li>
              <li>Dodaj handlowca i przypisz grupę.</li>
              <li>
                Wygeneruj <strong className="font-medium text-slate-800">link zaproszenia</strong> —
                hasło i powiązanie ustawią się automatycznie.
              </li>
            </ol>
            <p>
              Alternatywa: ręczne konto w{" "}
              <Link href="/admin/uzytkownicy" className={brandLinkClass}>
                Konta
              </Link>
              . Dla kierownika przypisz grupy w zakładce Konta.
            </p>
          </>
        )}
      </div>
    </details>
  );
}
