import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
const shortcuts = [
  {
    href: "/admin/dostawcy",
    title: "Karty dostawców (pełne)",
    description: "Jak w sekcji Dostawcy, z możliwością usuwania rekordów.",
  },
  {
    href: "/zakupy/dostawcy",
    title: "Karty dostawców (zakupy)",
    description: "Codzienna edycja bez usuwania — ten sam widok co dla działu zakupów.",
  },
  {
    href: "/lokalizacje/POLSKA",
    title: "Terminy zamówień",
    description: "Daty cyklu — Polska, zagranica, import.",
  },
  {
    href: "/zakupy/urlopy",
    title: "Urlopy dostawców",
    description: "Okresy niedostępności i przeliczanie harmonogramów.",
  },
] as const;

export function AdminDataShortcuts() {
  return (
    <Card padding={false}>
      <CardHeader
        inset
        title="Dane operacyjne"
        description="Codzienna praca w menu Dostawcy. Poniżej skróty, gdy potrzebujesz wersji z usuwaniem lub pełnego dostępu administratora."
      />
      <ul className="divide-y divide-slate-100">
        {shortcuts.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex flex-col gap-0.5 px-6 py-4 transition hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{item.title}</p>
                <p className="mt-0.5 text-sm text-slate-500">{item.description}</p>
              </div>
              <span className="mt-2 shrink-0 text-sm font-medium text-sky-700 sm:mt-0">
                Otwórz →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
