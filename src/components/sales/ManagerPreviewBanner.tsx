"use client";

import Link from "next/link";
import { buildNotatnikPageHref } from "@/lib/sales/notepad-page-tabs";
import { useAdminPanelPreview } from "@/components/layout/AdminPanelPreviewContext";
import { Button } from "@/components/ui/Button";
import { SystemNotice } from "@/components/ui/SystemNotice";
import { salesTouchTargetClass } from "@/lib/ui/ontime-theme";
import { IconChevronLeft, IconSun } from "@/components/icons/StrokeIcons";

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
  isDelegate,
  startDate,
  endDate,
  className,
}: {
  salesPersonName: string;
  salesPersonId: string;
  scope?: ManagerPreviewScope;
  /** Administrator — tylko podgląd, bez składania prośb. */
  readOnly?: boolean;
  isDelegate?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  className?: string;
}) {
  const { readOnly: globalPanelPreview } = useAdminPanelPreview();

  if (globalPanelPreview && readOnly) {
    return null;
  }

  const scopeLabel = SCOPE_LABEL[scope];

  const dateRange = startDate && endDate
    ? `${startDate} → ${endDate}`
    : endDate
      ? `do ${endDate}`
      : null;

  const description = isDelegate
    ? scope === "zk"
      ? "Tryb zastępstwa — możesz zamykać ZK i potwierdzać odbiory. Edycja notatek i dodawanie ZK są wyłączone."
      : scope === "notatnik"
        ? "Tryb zastępstwa — notatki tylko do odczytu. ZK możesz zamykać w zakładce ZK."
        : scope === "orders"
          ? "Tryb zastępstwa — możesz potwierdzać odbiory i zamykać ZK. Edycja, anulowanie i składanie nowych próśb są wyłączone."
          : "Tryb zastępstwa — ograniczone uprawnienia."
    : readOnly
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

  const backToOwnPanel = (
    <Link href="/moje">
      <Button size="sm" variant="primary" className={salesTouchTargetClass}>
        <IconChevronLeft size={14} />
        Wróć do swojego panelu
      </Button>
    </Link>
  );

  const actions = isDelegate ? (
    <>
      {backToOwnPanel}
      {scope === "notatnik" || scope === "zk" ? (
        <Link href={`/moje?dla=${salesPersonId}`}>
          <Button size="sm" variant="secondary" className={salesTouchTargetClass}>
            Panel zamówień
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
      ) : null}
    </>
  ) : !readOnly ? (
    <>
      {backToOwnPanel}
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
      ) : null}
    </>
  ) : (
    <>
      {backToOwnPanel}
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
      title={
        isDelegate ? (
          <span className="inline-flex items-center gap-2">
            <IconSun size={16} className="text-amber-500" />
            {`Zastępujesz: ${salesPersonName}`}
          </span>
        ) : (
          `Podgląd ${scopeLabel}: ${salesPersonName}`
        )
      }
      description={
        isDelegate && dateRange ? (
          <span>
            <span className="font-medium text-slate-700">Aktywne zastępstwo: {dateRange}</span>
            <span className="mt-0.5 block">{description}</span>
          </span>
        ) : (
          description
        )
      }
      action={actions}
    />
  );
}
