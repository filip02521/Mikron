"use client";

import Link from "next/link";
import { HelpPopover, GuideIcon } from "@/components/ui/HelpPopover";
import { HelpBlock } from "@/components/ui/HelpBlock";
import { panelToolbarTextButtonClass } from "@/lib/ui/ontime-theme";

export function DepartmentBoardProcurementGuide() {
  return (
    <HelpPopover
      label="Pomoc — tablica z handlowcami"
      title="Tablica"
      shortLabel="Pomoc"
      icon={<GuideIcon />}
      buttonClassName={panelToolbarTextButtonClass}
    >
      <HelpBlock title="Ogłoszenia">
        <p>
          Komunikat do całego działu handlowego. Ważne wpisy możesz przypiąć i ustawić datę
          ważności.
        </p>
      </HelpBlock>

      <HelpBlock title="Pytania">
        <p>
          Pytanie od handlowca — odpowiedź widzi cały dział. Po udzieleniu odpowiedzi możesz
          zarchiwizować wątek.
        </p>
      </HelpBlock>

      <HelpBlock title="Gdzie indziej">
        <p>
          Notatki wewnętrzne działu — w{" "}
          <Link href="/notatki" className="font-medium text-indigo-800 hover:underline">
            Notatki
          </Link>
          . Prośby o towar — w{" "}
          <Link href="/podsumowanie" className="font-medium text-indigo-800 hover:underline">
            panelu dziennym
          </Link>
          .
        </p>
      </HelpBlock>
    </HelpPopover>
  );
}
