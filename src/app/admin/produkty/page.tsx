import Link from "next/link";
import { AdminSecondaryShell } from "@/components/admin/AdminSecondaryShell";
import { buttonClass } from "@/components/ui/Button";
import { ProductsCatalogAdminClient } from "@/components/admin/ProductsCatalogAdminClient";
import {
  actionListCatalogAssignSuppliers,
  actionListSubiektLinkedSuppliers,
} from "@/app/actions/product-catalog";
import {
  countProductCatalogCoverage,
  fetchProductCatalogPage,
} from "@/lib/data/product-catalog-queries";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("adminProducts");

export default async function AdminProduktyPage() {
  const [page, coverage] = await Promise.all([
    fetchProductCatalogPage({ limit: 250, offset: 0 }),
    countProductCatalogCoverage(),
  ]);
  const [suppliers, assignSuppliers] = await Promise.all([
    actionListSubiektLinkedSuppliers(),
    actionListCatalogAssignSuppliers(),
  ]);

  return (
    <AdminSecondaryShell
      title="Katalog produktów"
      description="Własna baza powiązań produkt → dostawca (Subiekt tw_Id). Źródła: historia próśb, weryfikacja zakupów, import z ZD."
      action={
        <Link
          href="/admin/produkty/zeby"
          className={buttonClass("secondary", "md", "max-sm:min-h-11")}
        >
          Produkty zębne
        </Link>
      }
    >
      <ProductsCatalogAdminClient
        initial={page}
        coverage={coverage}
        suppliers={suppliers}
        assignSuppliers={assignSuppliers}
      />
    </AdminSecondaryShell>
  );
}
