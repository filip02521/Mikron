export type AdminHubTab = "system" | "users" | "sales";

export const ADMIN_HUB_TAB_COPY: Record<
  AdminHubTab,
  { label: string; hint: string }
> = {
  system: {
    label: "System",
    hint: "Status, harmonogramy cron i narzędzia serwisowe",
  },
  users: {
    label: "Konta",
    hint: "Logowanie, role i hasła",
  },
  sales: {
    label: "Handlowcy",
    hint: "Osoby, e-maile i powiązania z kontami",
  },
};

export function adminHubPaths() {
  return {
    system: "/admin",
    users: "/admin/uzytkownicy",
    sales: "/admin/handlowcy",
  } as const;
}

export function activeAdminHubTab(pathname: string): AdminHubTab {
  if (pathname.startsWith("/admin/uzytkownicy")) return "users";
  if (pathname.startsWith("/admin/handlowcy")) return "sales";
  return "system";
}

export function adminHubHint(tab: AdminHubTab): string {
  switch (tab) {
    case "system":
      return "Sprawdź status bazy, uruchom przeliczenie po importach lub gdy terminy się rozjechały. Na co dzień wystarczy automatyczny cron — przyciski poniżej to awaryjna obsługa.";
    case "users":
      return "Konto logowania ≠ karta handlowca: handlowiec musi być na liście Handlowcy, potem tworzysz konto z rolą „handlowiec” i powiązaniem. Zaproszenia generujesz z zakładki Handlowcy.";
    case "sales":
      return "Lista osób do powiadomień i panelu „Moje zamówienia”. Grupy (Sklep, Biuro) zakładasz w menu Grupy; kierowników przypisujesz w zakładce Konta.";
  }
}
