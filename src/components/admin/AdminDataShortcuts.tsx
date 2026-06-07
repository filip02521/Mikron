import Link from "next/link";
import { LinkChevron } from "@/components/ui/UiGlyphs";
import { Card, CardHeader } from "@/components/ui/Card";
import { supplierHubPaths } from "@/lib/supplier-hub";

const adminPaths = supplierHubPaths("admin");
const zakupyPaths = supplierHubPaths("zakupy");

const shortcuts = [
  {
    href: zakupyPaths.cards,
    title: "Karty dostawców (zakupy)",
    description: "Codzienna edycja bez usuwania — ten sam widok co dla działu zakupów.",
  },
  {
    href: adminPaths.cards,
    title: "Karty dostawców (admin)",
    description: "Wersja z usuwaniem rekordów — domyślnie w menu Dostawcy dla administratora.",
  },
  {
    href: adminPaths.schedule("POLSKA"),
    title: "Terminy zamówień",
    description: "Daty cyklu — Polska, zagranica, import.",
  },
  {
    href: adminPaths.vacations,
    title: "Urlopy dostawców",
    description: "Okresy niedostępności i przeliczanie harmonogramów.",
  },
  {
    href: "/admin/produkty",
    title: "Produkty (baza własna)",
    description: "Powiązania produkt ↔ dostawca (Subiekt tw_Id) + notatki i metryki.",
  },
] as const;

export function AdminDataShortcuts() {
  return (
    <Card padding={false} className="overflow-hidden">
      <CardHeader
        inset
        density="compact"
        title="Dane operacyjne"
        description="Skróty do hubu dostawców i katalogu. Administrator domyślnie korzysta z wersji admin w menu po lewej."
      />
      <ul className="divide-y divide-slate-100">
        {shortcuts.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex flex-col gap-0.5 px-3 py-3 transition hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between sm:px-4 lg:px-5"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{item.title}</p>
                <p className="mt-0.5 text-sm text-slate-500">{item.description}</p>
              </div>
              <span className="mt-2 inline-flex shrink-0 items-center gap-1 text-sm font-medium text-indigo-700 sm:mt-0">
                Otwórz
                <LinkChevron tone="brand" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
