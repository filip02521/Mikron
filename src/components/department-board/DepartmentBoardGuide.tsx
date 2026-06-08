"use client";

import Link from "next/link";
import { HelpPopover, GuideIcon } from "@/components/ui/HelpPopover";
import { IconClipboardList, IconInbox } from "@/components/icons/StrokeIcons";

export function DepartmentBoardGuide() {
  return (
    <HelpPopover
      label="Czym różni się od prośby"
      title="Komunikacja z działem zakupów"
      shortLabel="Pomoc"
      icon={<GuideIcon />}
    >
      <p className="mb-2 flex items-start gap-2">
        <IconClipboardList size={16} className="mt-0.5 shrink-0 text-indigo-600" />
        <span>
          <Link href="/prosba" className="font-medium text-indigo-800 hover:underline">
            Nowa prośba
          </Link>{" "}
          — gdy chcesz <strong className="font-medium text-slate-800">zamówić towar</strong> u
          dostawcy lub sprawdzić dostępność w procesie. Status śledzisz w Moje zamówienia.
        </span>
      </p>
      <p className="mb-2 flex items-start gap-2">
        <IconInbox size={16} className="mt-0.5 shrink-0 text-sky-700" />
        <span>
          <strong className="font-medium text-slate-800">Ogłoszenia</strong> — jednokierunkowy
          komunikat od zakupów (np. zmiana procedury). Nie odpowiadasz na ogłoszenie w tej sekcji.
        </span>
      </p>
      <p className="flex items-start gap-2">
        <IconInbox size={16} className="mt-0.5 shrink-0 text-amber-700" />
        <span>
          <strong className="font-medium text-slate-800">Pytania zespołu</strong> — ogólne pytanie
          do zakupów; odpowiedź widzą wszyscy handlowcy (żeby nie powtarzać tego samego w mailu).
        </span>
      </p>
    </HelpPopover>
  );
}
