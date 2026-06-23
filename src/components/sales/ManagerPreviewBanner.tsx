"use client";

import Link from "next/link";
import { buildNotatnikPageHref } from "@/lib/sales/notepad-page-tabs";
import { useAdminPanelPreview } from "@/components/layout/AdminPanelPreviewContext";
import { Button } from "@/components/ui/Button";
import { SystemNotice } from "@/components/ui/SystemNotice";
import { salesTouchTargetClass } from "@/lib/ui/ontime-theme";

export type ManagerPreviewScope = "orders" | "notatnik" | "zk" | "plan" | "tablica" | "prosba";

const SCOPE_LABEL: Record<ManagerPreviewScope, string> = {
  orders: "prośb handlowca",
  notatnik: "notatnika",
  zk: "ZK czekających",
  plan: "harmonogramu",
  tablica: "tablicy",
  prosba: "formularza prośby",
};

export function ManagerPreviewBanner({
  salesPersonName,
  salesPersonId,
  scope = "orders",
  readOnly,
  className,
}: {
  salesPersonName: string;
  salesPersonId: string;
  scope?: ManagerPreviewScope;
  /** Administrator — tylko podgląd, bez składania prośb. */
  readOnly?: boolean;
  className?: string;
}) {
  const { readOnly: globalPanelPreview } = useAdminPanelPreview();

  if (globalPanelPreview && readOnly) {
    return null;
  }

  const scopeLabel = SCOPE_LABEL[scope];

  const description = readOnly
    ? scope === "zk"
      ? "Tryb administratora — tylko odczyt. Edycja ZK i składanie prośb są wyłączone."
      : scope === "notatnik"
        ? "Tryb administratora — tylko odczyt. Edycja notatek jest wyłączona."
        : scope === "orders"
          ? "W podglądzie widać aktywne prośby, archiwum i zapisane terminy ZD — bez odświeżania z Subiekta i bez potwierdzania odbioru."
          : "Tryb administratora — tylko odczyt. Składanie prośb i edycja danych są wyłączone."
    : scope === "zk"
      ? "Tryb podglądu — edycja ZK tylko we własnej zakładce ZK czekające."
      : scope === "notatnik"
      ? "Tryb podglądu — edycja notatek tylko we własnym Notatniku."
      : scope === "prosba"
        ? "Składasz prośbę w imieniu wybranego handlowca — potwierdzenie odbioru tylko na jego koncie."
        : scope === "plan" || scope === "tablica"
          ? "Widok wybranego handlowca — zmiany wprowadzasz tylko we własnym koncie lub przez delegację prośby."
          : scope === "orders"
            ? "Potwierdzenie odbioru tylko na własnym koncie. Archiwum w podglądzie jest tylko do odczytu."
            : "Potwierdzenie odbioru i archiwum są dostępne tylko na własnym koncie handlowca.";

  const actions = !readOnly ? (
    <>
      {scope === "notatnik" || scope === "zk" ? (
        <Link href={`/moje?dla=${salesPersonId}`}>
          <Button size="sm" variant="secondary" className={salesTouchTargetClass}>
            Panel zamówień
          </Button>
        </Link>
      ) : scope !== "prosba" ? (
        <Link href={`/prosba?dla=${salesPersonId}`}>
          <Button size="sm" variant="secondary" className={salesTouchTargetClass}>
            Prośba w jego imieniu
          </Button>
        </Link>
      ) : null}
      {scope === "notatnik" || scope === "zk" ? (
        <Link
          href={buildNotatnikPageHref({
            preview: true,
            salesPersonId,
            tab: scope === "zk" ? "zk" : "notes",
            surface: scope === "zk" ? "zk" : "notes",
          })}
        >
          <Button size="sm" variant="outline" className={salesTouchTargetClass}>
            {scope === "zk" ? "Moje ZK" : "Mój notatnik"}
          </Button>
        </Link>
      ) : scope === "orders" ? (
        <Link href="/moje">
          <Button size="sm" variant="outline" className={salesTouchTargetClass}>
            Moje zamówienia
          </Button>
        </Link>
      ) : null}
    </>
  ) : (
    <>
      <Link href={`/moje?dla=${salesPersonId}`}>
        <Button size="sm" variant="secondary" className={salesTouchTargetClass}>
          Prośby
        </Button>
      </Link>
      <Link href={buildNotatnikPageHref({ preview: true, salesPersonId })}>
        <Button size="sm" variant="outline" className={salesTouchTargetClass}>
          ZK
        </Button>
      </Link>
      <Link href={buildNotatnikPageHref({ preview: true, salesPersonId, tab: "notes" })}>
        <Button size="sm" variant="outline" className={salesTouchTargetClass}>
          Notatnik
        </Button>
      </Link>
      <Link href={`/plan?dla=${salesPersonId}`}>
        <Button size="sm" variant="outline" className={salesTouchTargetClass}>
          Plan
        </Button>
      </Link>
      <Link href={`/tablica?dla=${salesPersonId}`}>
        <Button size="sm" variant="outline" className={salesTouchTargetClass}>
          Tablica
        </Button>
      </Link>
    </>
  );

  return (
    <SystemNotice
      variant="action"
      className={className ?? "mb-4"}
      title={`Podgląd ${scopeLabel}: ${salesPersonName}`}
      description={description}
      action={actions}
    />
  );
}
