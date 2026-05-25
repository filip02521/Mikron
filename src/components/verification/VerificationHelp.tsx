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
        produktu lub ilości. Uzupełnij pola i zatwierdź; prośba pojawi się w panelu dziennym
        jako „Nowe”.
      </p>
      <p className="mt-2">
        Możesz też otworzyć weryfikację z panelu dziennego (baner przy prośbach). Anulowanie
        usuwa prośbę — używaj tylko gdy zgłoszenie było błędne.
      </p>
    </HelpPopover>
  );
}
