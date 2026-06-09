"use client";

import Link from "next/link";
import { HelpPopover } from "@/components/ui/HelpPopover";
import { HelpBlock } from "@/components/ui/HelpBlock";
import { useAppRole } from "@/components/layout/AppRoleContext";
import { supplierHubPaths, type SupplierHubContext } from "@/lib/supplier-hub";

export function SupplierCardsHelpButton({ context }: { context: SupplierHubContext }) {
  const role = useAppRole();
  const adminPaths = supplierHubPaths("admin");
  const zakupyPaths = supplierHubPaths("zakupy");

  return (
    <HelpPopover
      label="Pomoc — karty dostawców"
      title="Karty dostawców"
      shortLabel="Pomoc"
      align="right"
    >
      <HelpBlock title="Co zawiera karta">
        <p>
          Nazwa, kontakt, sposób zamówienia, częstotliwość zamówień i zapas (okres większego
          domówienia).
        </p>
      </HelpBlock>

      <HelpBlock title="Terminy">
        <p>Konkretne daty w harmonogramie — edycja w zakładce Terminy zamówień.</p>
      </HelpBlock>

      <HelpBlock title="Edycja">
        <ul className="list-disc space-y-1.5 pl-4">
          <li>Kliknij nazwę dostawcy, aby edytować kartę z boku.</li>
          <li>
            Dostawcy niepowiązani z Subiektem są podświetleni na żółto — powiąż ich w
            formularzu edycji.
          </li>
        </ul>
      </HelpBlock>

      {context === "admin" ? (
        <HelpBlock title="Wersja dla zakupów">
          <p>
            Codzienna edycja bez usuwania rekordów —{" "}
            <Link
              href={zakupyPaths.cards}
              className="font-medium text-indigo-800 underline underline-offset-2"
            >
              karty w sekcji Dostawcy (zakupy)
            </Link>
            .
          </p>
        </HelpBlock>
      ) : role === "admin" ? (
        <HelpBlock title="Wersja administracyjna">
          <p>
            Wersja z trwałym usuwaniem rekordów —{" "}
            <Link
              href={adminPaths.cards}
              className="font-medium text-indigo-800 underline underline-offset-2"
            >
              karty w administracji
            </Link>
            .
          </p>
        </HelpBlock>
      ) : null}
    </HelpPopover>
  );
}
