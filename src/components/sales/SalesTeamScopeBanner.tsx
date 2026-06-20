import { SystemNotice } from "@/components/ui/SystemNotice";

/** Kierownictwo bez przypisanych grup — administrator ustawia je w panelu użytkowników. */
export function SalesTeamScopeBanner() {
  return (
    <SystemNotice
      variant="pinned"
      role="alert"
      className="mb-0"
      title="Brak przypisanych grup zespołu"
      description="Listy handlowców i grup będą puste, dopóki administrator nie przypisze Ci grup (np. Sklep, Biuro) przy koncie z rolą Kierownictwo — w panelu użytkowników, przy zapisie uprawnień."
    />
  );
}
