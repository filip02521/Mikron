import Link from "next/link";
import { LinkChevron } from "@/components/ui/UiGlyphs";
import { Card, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { panelTypography } from "@/lib/ui/ontime-theme";
import { supplierHubPaths } from "@/lib/supplier-hub";

const adminPaths = supplierHubPaths("admin");
const zakupyPaths = supplierHubPaths("zakupy");

const shortcuts = [
  {
    href: zakupyPaths.cards,
    title: "Karty dostawców (zakupy)",
    description: "Codzienna edycja bez usuwania - ten sam widok co dla działu zakupów.",
  },
  {
    href: adminPaths.cards,
    title: "Karty dostawców (admin)",
    description: "Wersja z usuwaniem rekordów - domyślnie w menu Dostawcy dla administratora.",
  },
  {
    href: adminPaths.schedule("POLSKA"),
    title: "Terminy zamówień",
    description: "Daty cyklu - Polska, zagranica, import.",
  },
  {
    href: adminPaths.vacations,
    title: "Urlopy dostawców",
    description: "Okresy niedostępności i przeliczanie harmonogramów.",
  },
    {
      href: "/admin/produkty",
      title: "Katalog produktów",
      description: "Powiązania produkt ↔ dostawca, synchronizacja ZD i metryki.",
    },
    {
      href: "/admin/produkty/zeby",
      title: "Produkty zębne",
      description: "Lista towarów bez kontroli stanu magazynowego przy prośbach o zamówienie.",
    },
  ] as const;

export function AdminDataShortcuts() {
  return (
    <Card padding={false} className="overflow-hidden">
      <CardHeader
        inset
        density="compact"
        title="Dane operacyjne"
        description="Skróty do hubu dostawców i katalogu. Wersja admin dostawców jest też w menu po lewej."
      />
      <ul className="grid divide-y divide-slate-100 sm:grid-cols-2 sm:divide-y-0">
        {shortcuts.map((item) => (
          <li key={item.href} className="sm:border-b sm:border-slate-100 sm:odd:border-r">
            <Link
              href={item.href}
              className="group flex min-h-14 items-center gap-3 px-3 py-3 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus sm:px-4 lg:px-5"
            >
              <span className="min-w-0 flex-1">
                <span className={cn(panelTypography.rowTitle, "block group-hover:text-indigo-800")}>{item.title}</span>
                <span className={cn(panelTypography.rowMeta, "mt-0.5 block")}>{item.description}</span>
              </span>
              <LinkChevron tone="brand" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
