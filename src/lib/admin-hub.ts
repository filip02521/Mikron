export type AdminHubTab = "system" | "users" | "sales" | "mail" | "wysylki";

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
  mail: {
    label: "Ivoclar",
    hint: "Status i historia wysyłek Ivoclar (odczyt — wysyłka w OnTime Raporty)",
  },
  wysylki: {
    label: "Wysyłki OT",
    hint: "Podgląd transakcyjnych maili OnTime (dostawy, informacja, OTP, tablica)",
  },
};

export function adminHubPaths() {
  return {
    system: "/admin",
    users: "/admin/uzytkownicy",
    sales: "/admin/handlowcy",
    mail: "/admin/mail",
    wysylki: "/admin/wysylki",
  } as const;
}

export function activeAdminHubTab(pathname: string): AdminHubTab {
  if (pathname.startsWith("/admin/uzytkownicy")) return "users";
  if (pathname.startsWith("/admin/handlowcy")) return "sales";
  if (pathname.startsWith("/admin/mail")) return "mail";
  if (pathname.startsWith("/admin/wysylki")) return "wysylki";
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
    case "mail":
      return "Centrum maili Ivoclar jest tylko do odczytu: status joba, odbiorcy i historia wysyłek. Generowanie prowadzi OnTime Raporty.";
    case "wysylki":
      return "Każdy mail transakcyjny OnTime (SES) jest logowany z treścią HTML. Kody OTP w podglądzie są zredagowane. Filtruj po typie i statusie.";
  }
}
