"use client";

import Link from "next/link";
import { HelpPopover, GuideIcon } from "@/components/ui/HelpPopover";
import { HelpBlock } from "@/components/ui/HelpBlock";
import { cn } from "@/lib/cn";
import { pageToolbarSizingClass, pageToolbarSurfaceClass } from "@/lib/ui/ontime-theme";
import {
  INFORMACJA_FLOW_DIRECT,
  INFORMACJA_FLOW_STOCK_OUT,
} from "@/lib/orders/informacja-flow-copy";

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
      label="Pomoc — jak złożyć prośbę"
      title="Nowa prośba"
      shortLabel="Pomoc"
      icon={<GuideIcon />}
      buttonClassName={cn(pageToolbarSurfaceClass, pageToolbarSizingClass, "px-2.5")}
    >
      <HelpBlock title="Co tu zgłaszasz">
        <p>
          Formalne zgłoszenie do działu zakupów — zamówienie u dostawcy albo informacja o
          dostępności towaru. Ogólne pytanie bez zamawiania zadaj na{" "}
          <Link href="/tablica" className="font-medium text-indigo-700 hover:underline">
            Tablicy
          </Link>
          .
        </p>
      </HelpBlock>

      <HelpBlock title="Rodzaj prośby">
        <ul className="list-disc space-y-1.5 pl-4">
          <li>
            <strong className="font-medium text-slate-800">Zamówienie u dostawcy</strong> — składamy
            zamówienie, status śledzisz w „Moje zamówienia”.
          </li>
          <li>
            <strong className="font-medium text-slate-800">Informacja o towarze</strong> — wariant{" "}
            <span className="font-medium">{INFORMACJA_FLOW_DIRECT.label}</span> (e-mail + wpis u
            Ciebie) albo{" "}
            <span className="font-medium">{INFORMACJA_FLOW_STOCK_OUT.label}</span> (tylko sygnał dla
            zakupów).
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
