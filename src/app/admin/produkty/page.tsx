import { AdminSecondaryShell } from "@/components/admin/AdminSecondaryShell";
import { ProductsCatalogAdminClient } from "@/components/admin/ProductsCatalogAdminClient";
import {
  actionListCatalogAssignSuppliers,
  actionListSubiektLinkedSuppliers,
} from "@/app/actions/product-catalog";
import {
  countProductCatalogCoverage,
  fetchProductCatalogPage,
} from "@/lib/data/product-catalog-queries";

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
      description="Własna baza powiązań produkt → dostawca (Subiekt tw_Id). Źródła: historia prośb, weryfikacja zakupów, import z ZD."
      iconKey="groupOrder"
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
