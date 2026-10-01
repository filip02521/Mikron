import Link from "next/link";
import { LinkChevron } from "@/components/ui/UiGlyphs";
import { Card, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { panelTextLinkClass, panelTypography } from "@/lib/ui/ontime-theme";
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
      <div className="grid gap-3 px-3 pb-4 sm:grid-cols-2 sm:px-4 lg:px-5">
        {shortcuts.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex min-h-[5.5rem] flex-col justify-between rounded-md border border-slate-200/90",
              "bg-white p-3 transition hover:border-indigo-200/90 hover:bg-indigo-50/20"
            )}
          >
            <div className="min-w-0">
              <p className={panelTypography.rowTitle}>{item.title}</p>
              <p className={cn(panelTypography.rowMeta, "mt-1")}>{item.description}</p>
            </div>
            <span
              className={cn(
                panelTextLinkClass,
                "mt-3 inline-flex items-center gap-1 text-sm font-medium"
              )}
            >
              Otwórz
              <LinkChevron tone="brand" />
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
