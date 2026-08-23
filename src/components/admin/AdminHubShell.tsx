"use client";

import { NavIcon } from "@/components/icons/NavIcon";
import { navIconTileIdleClass, type NavIconKey } from "@/components/icons/NavIcon";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { AdminHubNav } from "@/components/admin/AdminHubNav";
import { Card, CardHeader } from "@/components/ui/Card";
import type { AdminHubTab } from "@/lib/admin-hub";
import { adminHubBodyClass, adminPageShellClass } from "@/lib/ui/ontime-theme";

const TAB_ICON: Record<AdminHubTab, NavIconKey> = {
  system: "admin",
  users: "teamAccounts",
  sales: "team",
  mail: "admin",
  wysylki: "admin",
};

const TAB_TITLE: Record<AdminHubTab, string> = {
  system: "Administracja",
  users: "Konta użytkowników",
  sales: "Handlowcy",
  mail: "Wysyłki Ivoclar",
  wysylki: "Wysyłki OnTime",
};

const TAB_DESCRIPTION: Record<AdminHubTab, string> = {
  system:
    "Konfiguracja długoterminowa: status systemu, Subiekt i narzędzia serwisowe. Operacje dzienne — w menu po lewej.",
  users: "Logowanie do systemu, role i hasła. Handlowiec musi mieć kartę w zakładce Handlowcy.",
  sales:
    "Osoby kontaktowe, powiadomienia e-mail i linki zaproszeń do zakładania kont.",
  mail: "Status i historia wysyłek Ivoclar (odczyt — bez sterowania z OnTime).",
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
  const iconKey = TAB_ICON[activeTab];
  const headerTitle = title ?? TAB_TITLE[activeTab];
  const headerDescription = description ?? TAB_DESCRIPTION[activeTab];

  return (
    <div className={adminPageShellClass}>
      <AdminHubNav activeTab={activeTab} visibleTabs={visibleTabs} />
      <Card padding={false} className="mt-3 overflow-hidden">
        <CardHeader
          inset
          density="compact"
          leading={
            <SectionHeadingIcon tileClassName={navIconTileIdleClass(iconKey)}>
              <NavIcon navKey={iconKey} size={20} />
            </SectionHeadingIcon>
          }
          title={headerTitle}
          description={headerDescription}
          action={action}
        />

        <div className={adminHubBodyClass}>{children}</div>
      </Card>
    </div>
  );
}
