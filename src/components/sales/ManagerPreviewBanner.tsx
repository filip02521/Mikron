"use client";

import Link from "next/link";
import { buildNotatnikPageHref } from "@/lib/sales/notepad-page-tabs";
import { useAdminPanelPreview } from "@/components/layout/AdminPanelPreviewContext";
import { Button } from "@/components/ui/Button";
import { SystemNotice } from "@/components/ui/SystemNotice";

export type ManagerPreviewScope = "orders" | "notatnik" | "plan" | "tablica" | "prosba";

const SCOPE_LABEL: Record<ManagerPreviewScope, string> = {
  orders: "prośb handlowca",
  notatnik: "notatnika",
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
    ? "Tryb administratora — tylko odczyt. Składanie prośb i edycja notatnika są wyłączone."
    : scope === "notatnik"
      ? "Tryb podglądu — edycja notatnika tylko we własnej zakładce ZK czekające."
      : scope === "prosba"
        ? "Składasz prośbę w imieniu wybranego handlowca — potwierdzenie odbioru tylko na jego koncie."
        : scope === "plan" || scope === "tablica"
          ? "Widok wybranego handlowca — zmiany wprowadzasz tylko we własnym koncie lub przez delegację prośby."
          : "Potwierdzenie odbioru i archiwum są dostępne tylko na własnym koncie handlowca.";

  const actions = !readOnly ? (
    <>
      {scope === "notatnik" ? (
        <Link href={`/moje?dla=${salesPersonId}`}>
          <Button size="sm" variant="secondary">
            Panel zamówień
          </Button>
        </Link>
      ) : scope !== "prosba" ? (
        <Link href={`/prosba?dla=${salesPersonId}`}>
          <Button size="sm" variant="secondary">
            Prośba w jego imieniu
          </Button>
        </Link>
      ) : null}
      {scope === "notatnik" ? (
        <Link href={buildNotatnikPageHref()}>
          <Button size="sm" variant="outline">
            Mój notatnik
          </Button>
        </Link>
      ) : scope === "orders" ? (
        <Link href="/moje">
          <Button size="sm" variant="outline">
            Moje zamówienia
          </Button>
        </Link>
      ) : null}
    </>
  ) : (
    <>
      <Link href={`/moje?dla=${salesPersonId}`}>
        <Button size="sm" variant="secondary">
          Prośby
        </Button>
      </Link>
      <Link href={buildNotatnikPageHref({ preview: true, salesPersonId })}>
        <Button size="sm" variant="outline">
          Notatnik
        </Button>
      </Link>
      <Link href={`/plan?dla=${salesPersonId}`}>
        <Button size="sm" variant="outline">
          Plan
        </Button>
      </Link>
      <Link href={`/tablica?dla=${salesPersonId}`}>
        <Button size="sm" variant="outline">
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
