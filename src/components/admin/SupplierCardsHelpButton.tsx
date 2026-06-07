"use client";

import Link from "next/link";
import { HelpPopover } from "@/components/ui/HelpPopover";
import { useAppRole } from "@/components/layout/AppRoleContext";
import { supplierHubPaths, type SupplierHubContext } from "@/lib/supplier-hub";

export function SupplierCardsHelpButton({ context }: { context: SupplierHubContext }) {
  const role = useAppRole();
  const adminPaths = supplierHubPaths("admin");
  const zakupyPaths = supplierHubPaths("zakupy");

  return (
    <HelpPopover
      label="Pomoc: karty dostawców"
      title="Karty dostawców"
      shortLabel="?"
      align="right"
    >
      <ul className="list-disc space-y-2 pl-4 text-xs leading-relaxed">
        <li>
          <strong>Karta</strong> — nazwa, kontakt, sposób zamówienia, częstotliwość i zapas (okres
          większego zamówienia).
        </li>
        <li>
          <strong>Terminy</strong> — konkretne daty w harmonogramie; edycja w zakładce Terminy
          zamówień.
        </li>
        <li>Kliknij nazwę dostawcy, aby edytować kartę z boku.</li>
        <li>Niepowiązani z Subiektem są podświetleni na żółto — powiąż w formularzu edycji.</li>
        {context === "admin" ? (
          <li>
            Codzienna edycja bez usuwania rekordów —{" "}
            <Link
              href={zakupyPaths.cards}
              className="font-medium text-indigo-800 underline underline-offset-2"
            >
              karty w sekcji Dostawcy (zakupy)
            </Link>
            .
          </li>
        ) : role === "admin" ? (
          <li>
            Wersja z trwałym usuwaniem rekordów —{" "}
            <Link
              href={adminPaths.cards}
              className="font-medium text-indigo-800 underline underline-offset-2"
            >
              karty w administracji
            </Link>
            .
          </li>
        ) : null}
      </ul>
    </HelpPopover>
  );
}
