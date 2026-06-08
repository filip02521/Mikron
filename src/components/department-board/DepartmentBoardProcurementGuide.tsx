"use client";

import Link from "next/link";
import { HelpPopover, GuideIcon } from "@/components/ui/HelpPopover";
import { IconClipboardPen, IconInbox } from "@/components/icons/StrokeIcons";
import { panelToolbarTextButtonClass } from "@/lib/ui/ontime-theme";

export function DepartmentBoardProcurementGuide() {
  return (
    <HelpPopover
      label="Jak obsłużyć tablicę z handlowcami"
      title="Tablica z handlowcami"
      shortLabel="Pomoc"
      icon={<GuideIcon />}
      buttonClassName={panelToolbarTextButtonClass}
    >
      <p className="mb-2 flex items-start gap-2">
        <IconInbox size={16} className="mt-0.5 shrink-0 text-indigo-600" />
        <span>
          <strong className="font-medium text-slate-800">Ogłoszenia</strong> — komunikat do całego
          działu handlowego (jednokierunkowo). Możesz przypiąć ważne wpisy i ustawić datę ważności.
        </span>
      </p>
      <p className="mb-2 flex items-start gap-2">
        <IconClipboardPen size={16} className="mt-0.5 shrink-0 text-amber-700" />
        <span>
          <strong className="font-medium text-slate-800">Pytania</strong> — odpowiedź widzi cały
          dział handlowy. Po udzieleniu odpowiedzi możesz zarchiwizować wątek.
        </span>
      </p>
      <p className="text-slate-600">
        Wewnętrzne notatki działu (prywatne / wspólne) nadal są w{" "}
        <Link href="/notatki" className="font-medium text-indigo-800 hover:underline">
          Notatki
        </Link>
        . Prośby o towar obsługujesz w{" "}
        <Link href="/podsumowanie" className="font-medium text-indigo-800 hover:underline">
          panelu dziennym
        </Link>
        .
      </p>
    </HelpPopover>
  );
}
