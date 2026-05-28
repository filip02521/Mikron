import { PageHeader } from "@/components/ui/PageHeader";
import { AdminHubNav } from "@/components/admin/AdminHubNav";
import { ProductsCatalogAdminClient } from "@/components/admin/ProductsCatalogAdminClient";
import { fetchProductCatalogRows } from "@/lib/data/product-catalog-queries";
import { actionListSubiektLinkedSuppliers } from "@/app/actions/product-catalog";

export default async function AdminProduktyPage() {
  const rows = await fetchProductCatalogRows({ limit: 250 });
  const suppliers = await actionListSubiektLinkedSuppliers();
  return (
    <>
      <PageHeader
        title="Produkty"
        description="Własna baza powiązań produkt → dostawca (Subiekt tw_Id). Źródła: historia prośb, weryfikacja zakupów, import z ZD."
      />
      <AdminHubNav activeTab="system" />
      <div className="mb-8">
        <ProductsCatalogAdminClient initial={rows} suppliers={suppliers} />
      </div>
    </>
  );
}

