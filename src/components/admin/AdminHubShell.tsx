"use client";

import { AdminHubNav } from "@/components/admin/AdminHubNav";
import { PageHeader } from "@/components/ui/PageHeader";
import type { AdminHubTab } from "@/lib/admin-hub";
import { adminPageShellClass } from "@/lib/ui/ontime-theme";

const TAB_TITLE: Record<AdminHubTab, string> = {
  system: "Administracja",
  users: "Konta użytkowników",
  sales: "Handlowcy",
  mail: "Wysyłki Ivoclar",
  wysylki: "Wysyłki OnTime",
};

const TAB_DESCRIPTION: Record<AdminHubTab, string> = {
  system:
    "Konfiguracja długoterminowa: status systemu, Subiekt i narzędzia serwisowe. Operacje dzienne - w menu po lewej.",
  users: "Logowanie do systemu, role i hasła. Handlowiec musi mieć kartę w zakładce Handlowcy.",
  sales:
    "Osoby kontaktowe, powiadomienia e-mail i linki zaproszeń do zakładania kont.",
  mail: "Status i historia wysyłek Ivoclar (odczyt - bez sterowania z OnTime).",
  wysylki:
    "Podgląd wszystkich maili transakcyjnych wysyłanych przez OnTime (dostawy, magazyn, OTP, tablica).",
};

export function AdminHubShell({
  activeTab,
  visibleTabs,
  title,
  description,
  action,
  children,
}: {
  activeTab: AdminHubTab;
  /** Ograniczenie zakładek (np. tylko Ivoclar dla użytkowników z modułem). */
  visibleTabs?: readonly AdminHubTab[];
  /** Nadpisanie tytułu z domyślnej mapy zakładki. */
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const headerTitle = title ?? TAB_TITLE[activeTab];
  const headerDescription = description ?? TAB_DESCRIPTION[activeTab];

  return (
    <div className={adminPageShellClass}>
      <PageHeader title={headerTitle} description={headerDescription} actions={action} />
      <AdminHubNav activeTab={activeTab} visibleTabs={visibleTabs} />
      <div className="min-w-0 space-y-6">{children}</div>
    </div>
  );
}
