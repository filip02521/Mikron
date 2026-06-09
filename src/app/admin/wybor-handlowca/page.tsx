import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { fetchSalesPeopleForPicker } from "@/lib/data/sales-people-admin";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { salesPageShellClass } from "@/lib/ui/ontime-theme";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wybór handlowca — podgląd",
};

export default async function WyborHandlowcaPage() {
  await requireAdmin();

  let people: Awaited<ReturnType<typeof fetchSalesPeopleForPicker>> = [];
  let loadError: string | null = null;

  try {
    people = await fetchSalesPeopleForPicker();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Nie udało się wczytać listy handlowców.";
  }

  return (
    <div className={salesPageShellClass}>
      <PageHeader
        title="Podgląd panelu handlowca"
        description="Wybierz osobę, aby zobaczyć jej zamówienia, harmonogram i notatnik — bez możliwości edycji."
      />

      {loadError ? <Alert tone="error">{loadError}</Alert> : null}

      {people.length === 0 && !loadError ? (
        <Alert tone="warning">
          Brak aktywnych handlowców. Wróć do{" "}
          <Link href="/admin" className="font-semibold text-amber-900 underline">
            panelu administracji
          </Link>{" "}
          i dodaj profile w sekcji Handlowcy.
        </Alert>
      ) : null}

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-200/80 bg-white shadow-[var(--shadow-card-elevated)]">
        {people.map((person) => (
          <li key={person.id}>
            <Link
              href={`/moje?dla=${person.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-slate-50"
            >
              <span>
                <span className="block text-sm font-semibold text-slate-900">{person.name}</span>
                {person.email ? (
                  <span className="mt-0.5 block text-xs text-slate-500">{person.email}</span>
                ) : null}
              </span>
              <span className="shrink-0 text-xs font-medium text-indigo-600">Podgląd →</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
