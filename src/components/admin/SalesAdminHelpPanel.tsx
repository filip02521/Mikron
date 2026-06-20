"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { brandLinkClass, salesChromeInsetClass } from "@/lib/ui/ontime-theme";

type SalesAdminHelpPanelProps = {
  managerMode?: boolean;
  /** W /zespol/handlowcy — bez osobnej karty, ciągłość z listą. */
  embedded?: boolean;
};

/** Zwijany przewodnik — zaproszenia, grupy i powiązanie z Kontami. */
export function SalesAdminHelpPanel({
  managerMode = false,
  embedded = false,
}: SalesAdminHelpPanelProps) {
  return (
    <details
      className={cn(
        "group",
        embedded
          ? "border-t border-slate-100"
          : "overflow-hidden rounded-md border border-slate-200/90 bg-white shadow-sm open:shadow-md"
      )}
    >
      <summary
        className={cn(
          "cursor-pointer list-none py-3 text-sm font-semibold text-slate-900 marker:content-none [&::-webkit-details-marker]:hidden",
          embedded ? salesChromeInsetClass : "px-3 sm:px-4"
        )}
      >
        <span className="flex items-center justify-between gap-2">
          <span>Jak działają karty i konta</span>
          <span className="text-slate-400 transition group-open:rotate-180">▾</span>
        </span>
      </summary>
      <div
        className={cn(
          "space-y-3 border-t border-slate-100 pb-4 pt-3 text-sm leading-relaxed text-slate-600",
          embedded ? salesChromeInsetClass : "px-3 sm:px-4"
        )}
      >
        {managerMode ? (
          <>
            <p>
              Dodajesz handlowca ze swojego zakresu grup. System tworzy kartę i konto z hasłem
              jednorazowym — przekaż je osobiście. Przy pierwszym logowaniu użytkownik ustawi własne
              hasło.
            </p>
            <p>
              Dla istniejących kont użyj{" "}
              <strong className="font-medium text-slate-800">Reset hasła</strong>. Bez konta możesz
              wygenerować link zaproszenia.
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
