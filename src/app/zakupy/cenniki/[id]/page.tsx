import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOperations } from "@/lib/auth";
import { isAdmin } from "@/lib/auth-roles";
import { PriceListReviewClient } from "@/components/zakupy/price-lists/PriceListReviewClient";
import { getPriceListImport, latestValidFrom, listPriceListItems, newerPriceListImport } from "@/lib/price-lists/data";
import { todayDateKeyInWarsaw } from "@/lib/time/warsaw";
import { getPricesHost } from "@/lib/price-lists/subiekt-prices";
import { pageMetadataFor } from "@/lib/ui/page-metadata";


export const metadata: Metadata = pageMetadataFor("priceLists");
export const dynamic = "force-dynamic";
/** Partia zapisu cen (50 pozycji) mieści się w tym limicie. */
export const maxDuration = 300;

export default async function PriceListReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ zaktualizowano?: string }>;
}) {
  const user = await requireOperations("read");
  const { id } = await params;
  const { zaktualizowano } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const imp = await getPriceListImport(id);
  if (!imp) notFound();
  const [items, newerImportId, latest] = await Promise.all([
    listPriceListItems(id),
    newerPriceListImport(imp),
    latestValidFrom(imp),
  ]);
  const host = await getPricesHost();

  // Szeroko: tabela cen ma 7 kolumn, a powód decyzji musi być widoczny bez przewijania w bok.
  return (
    <div className="relative mx-auto w-full max-w-7xl space-y-4">
      <PriceListReviewClient
        imp={imp}
        items={items}
        hostLabel={host.ok ? host.host.label : null}
        hostMatches={host.ok && host.host.hostKind === imp.hostKind}
        canApply={isAdmin(user.role)}
        newerImportId={newerImportId}
        justUpdated={zaktualizowano === "1"}
        laterValidFrom={latest && imp.validFrom && latest > imp.validFrom ? latest : null}
        validInFuture={imp.validFrom != null && imp.validFrom > todayDateKeyInWarsaw()}
      />
    </div>
  );
}
