"use client";

import { HelpPopover, GuideIcon } from "@/components/ui/HelpPopover";
import { HelpBlock } from "@/components/ui/HelpBlock";

export function VerificationHelp() {
  return (
    <HelpPopover
      label="Pomoc — weryfikacja prośb"
      title="Weryfikacja zgłoszeń"
      shortLabel="Pomoc"
      icon={<GuideIcon />}
    >
      <HelpBlock title="Co tu jest">
        <p>
          Niekompletne prośby handlowców — brakuje dostawcy, produktu albo ilości. Weryfikację
          możesz też otworzyć z banera w panelu Dziś.
        </p>
      </HelpBlock>

      <HelpBlock title="Co zrobić">
        <p>Uzupełnij brakujące pola i zatwierdź prośbę.</p>
      </HelpBlock>

      <HelpBlock title="Prośby informacyjne">
        <p>
          Przy zwykłej informacji o dostępności wybierz ścieżkę przed zapisem. Przy „Brak na
          stanie” ścieżka jest ustalona — po zatwierdzeniu prośba trafi do panelu Dziś, nie do
          magazynu ani listy handlowca.
        </p>
      </HelpBlock>

      <HelpBlock title="Anulowanie">
        <p>Usuwa prośbę z systemu — używaj tylko wtedy, gdy zgłoszenie było błędne.</p>
      </HelpBlock>
    </HelpPopover>
  );
}
