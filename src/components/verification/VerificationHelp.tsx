"use client";

import { HelpPopover, GuideIcon } from "@/components/ui/HelpPopover";

export function VerificationHelp() {
  return (
    <HelpPopover
      label="Jak uzupełniać"
      title="Weryfikacja zgłoszeń"
      shortLabel="Pomoc"
      icon={<GuideIcon />}
    >
      <p>
        Tu trafiają <strong>niekompletne prośby</strong> od handlowców — brakuje dostawcy,
        produktu lub ilości. Uzupełnij pola i zatwierdź.
      </p>
      <p className="mt-2">
        Przy <strong>„Brak na stanie”</strong> ścieżka jest zablokowana — po zatwierdzeniu trafi
        do osobnej sekcji w panelu Dziś, nie do magazynu ani listy handlowca. Przy zwykłej
        informacji o dostępności wybierz ścieżkę przed zapisem.
      </p>
      <p className="mt-2">
        Możesz też otworzyć weryfikację z panelu dziennego (baner). Anulowanie usuwa prośbę —
        używaj tylko gdy zgłoszenie było błędne.
      </p>
    </HelpPopover>
  );
}
