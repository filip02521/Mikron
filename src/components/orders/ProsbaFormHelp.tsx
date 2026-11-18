"use client";

import Link from "next/link";
import { HelpPopover, GuideIcon } from "@/components/ui/HelpPopover";
import { HelpBlock } from "@/components/ui/HelpBlock";
import { cn } from "@/lib/cn";
import { pageToolbarSizingClass, pageToolbarSurfaceClass } from "@/lib/ui/ontime-theme";

/** Krótka pomoc — spójna z MojeOrdersHelp (popover zamiast dużego bloku). */
export function ProsbaFormHelp({
  mojeHref = "/moje",
  mojeLabel = "Moje zamówienia",
}: {
  mojeHref?: string;
  mojeLabel?: string;
}) {
  return (
    <HelpPopover
      label="Pomoc - jak złożyć prośbę"
      title="Nowa prośba"
      shortLabel="Pomoc"
      icon={<GuideIcon />}
      buttonClassName={cn(pageToolbarSurfaceClass, pageToolbarSizingClass, "px-2.5")}
    >
      <HelpBlock title="Co tu zgłaszasz">
        <p>
          Formalne zgłoszenie do działu zakupów - zamówienie u dostawcy albo informacja o
          towarze (np. powiadomienie, gdy pojawi się na magazynie). Ogólne pytanie bez zamawiania zadaj na{" "}
          <Link href="/tablica" className="font-medium text-indigo-700 hover:underline">
            Tablicy
          </Link>
          .
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-4">
          <li>
            Jeśli dostawca ma dziś aktywny urlop, zobaczysz subtelną informację -{" "}
            <strong className="font-medium text-slate-800">nie blokuje</strong> wysyłki; zakupy
            zobaczą to przy obsłudze.
          </li>
        </ul>
      </HelpBlock>

      <HelpBlock title="Rodzaj prośby">
        <ul className="list-disc space-y-1.5 pl-4">
          <li>
            <strong className="font-medium text-slate-800">Zamówienie u dostawcy</strong> - składamy
            zamówienie, status śledzisz w „Moje zamówienia”.
          </li>
          <li>
            <strong className="font-medium text-slate-800">Powiadom, gdy będzie</strong> - dostaniesz
            e-mail, gdy towar pojawi się na magazynie.
          </li>
          <li>
            <strong className="font-medium text-slate-800">Brak na stanie</strong> - to nie rodzaj
            prośby. Wybierz towar: gdy w karcie „Dostępność” na półce nie ma nic wolnego, kliknij „Zgłoś
            brak na stanie”. Zakupy dostaną osobny sygnał, a prośba się nie zmieni.
          </li>
        </ul>
      </HelpBlock>

      <HelpBlock title="Po wysłaniu">
        <p>
          Status zawsze w{" "}
          <Link href={mojeHref} className="font-medium text-indigo-700 hover:underline">
            {mojeLabel}
          </Link>
          . O ważnych zdarzeniach (np. towar na magazynie) dostaniesz też e-mail.
        </p>
      </HelpBlock>
    </HelpPopover>
  );
}
