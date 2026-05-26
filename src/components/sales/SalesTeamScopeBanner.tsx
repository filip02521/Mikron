import { Alert } from "@/components/ui/Alert";

/** Kierownik bez przypisanych grup — administrator ustawia je w panelu użytkowników. */
export function SalesTeamScopeBanner() {
  return (
    <Alert tone="warning" className="mb-4">
      <p className="font-medium">Brak przypisanych grup zespołu</p>
      <p className="mt-1 text-sm">
        Listy handlowców i grup będą puste, dopóki administrator nie przypisze Ci grup (np.
        Sklep, Biuro) przy koncie z rolą kierownika handlowców — w panelu użytkowników, przy
        zapisie uprawnień.
      </p>
    </Alert>
  );
}
