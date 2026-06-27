import { AdminSecondaryShell } from "@/components/admin/AdminSecondaryShell";
import { TeethProductsAdminClient } from "@/components/admin/TeethProductsAdminClient";
import { fetchTeethProducts } from "@/lib/data/teeth-products";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("adminTeethProducts");

export default async function AdminTeethProductsPage() {
  const rows = await fetchTeethProducts();

  return (
    <AdminSecondaryShell
      title="Produkty zębne"
      description="Lista towarów z wyłączoną kontrolą stanu magazynowego przy prośbach o zamówienie. Identyfikatory wczytywane z Subiekta (tw_Id)."
      iconKey="catalog"
      backHref="/admin/produkty"
      backLabel="Katalog produktów"
    >
      <TeethProductsAdminClient initial={rows} />
    </AdminSecondaryShell>
  );
}
