import { PageHeader } from "@/components/ui/PageHeader";
import { AdminHubNav } from "@/components/admin/AdminHubNav";
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
    <>
      <PageHeader
        title="Produkty"
        description="Własna baza powiązań produkt → dostawca (Subiekt tw_Id). Źródła: historia prośb, weryfikacja zakupów, import z ZD."
      />
      <AdminHubNav activeTab="system" />
      <div className="mb-8">
        <ProductsCatalogAdminClient
          initial={page}
          coverage={coverage}
          suppliers={suppliers}
          assignSuppliers={assignSuppliers}
        />
      </div>
    </>
  );
}

