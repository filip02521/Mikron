"use client";

import Link from "next/link";
import { HelpPopover, GuideIcon } from "@/components/ui/HelpPopover";
import { HelpBlock } from "@/components/ui/HelpBlock";

export function DepartmentBoardGuide() {
  return (
    <HelpPopover
      label="Pomoc — komunikacja z działem zakupów"
      title="Pytania zespołu"
      shortLabel="Pomoc"
      icon={<GuideIcon />}
    >
      <HelpBlock title="Nowa prośba">
        <p>
          <Link href="/prosba" className="font-medium text-indigo-800 hover:underline">
            Zgłoś prośbę
          </Link>{" "}
          — gdy chcesz zamówić towar u dostawcy albo sprawdzić dostępność w procesie. Status
          śledzisz w Moje zamówienia.
        </p>
      </HelpBlock>

      <HelpBlock title="Ogłoszenia od zakupów">
        <p>
          Komunikaty jednokierunkowe od działu zakupów znajdziesz w{" "}
          <Link href="/moje" className="font-medium text-indigo-800 hover:underline">
            Moje zamówienia
          </Link>
          , pod Startem dnia.
        </p>
      </HelpBlock>

      <HelpBlock title="Pytania zespołu">
        <p>
          Ogólne pytanie do zakupów — odpowiedź widzą wszyscy handlowcy, żeby nie powtarzać tego
          samego w mailu.
        </p>
      </HelpBlock>
    </HelpPopover>
  );
}
