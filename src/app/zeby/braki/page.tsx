import { requireTeethPanel } from "@/lib/auth";
import { fetchSuppliersForForm } from "@/lib/data/queries";
import { fetchTeethShortages } from "@/lib/data/teeth-shortages";
import { TeethShortagesClient } from "@/components/zeby/TeethShortagesClient";
import {
  TEETH_BRAKI_PAGE_HINT,
  TEETH_BRAKI_PAGE_TITLE,
} from "@/components/zeby/teeth-panel-copy";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadata(
  TEETH_BRAKI_PAGE_TITLE,
  TEETH_BRAKI_PAGE_HINT,
);

export const dynamic = "force-dynamic";

export default async function ZebyBrakiPage() {
  await requireTeethPanel("read");

  let shortages: Awaited<ReturnType<typeof fetchTeethShortages>> = [];
  let suppliers: { id: string; name: string }[] = [];
  let loadError: string | null = null;

  try {
    const [shortageRows, supplierRows] = await Promise.all([
      fetchTeethShortages({ includeInactive: true }),
      fetchSuppliersForForm(),
    ]);
    shortages = shortageRows;
    suppliers = supplierRows.map((s) => ({ id: s.id, name: s.name }));
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Nie udało się załadować listy braków.";
  }

  return (
    <TeethShortagesClient
      initialShortages={shortages}
      suppliers={suppliers}
      loadError={loadError}
    />
  );
}
