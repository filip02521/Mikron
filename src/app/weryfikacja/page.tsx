import {
  fetchSalesPeople,
  fetchSuppliersWithSchedules,
  fetchVerificationOrders,
} from "@/lib/data/queries";
import { VerificationClient } from "@/components/verification/VerificationClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import type { IndividualOrder } from "@/types/database";

export default async function WeryfikacjaPage() {
  let orders: IndividualOrder[] = [];
  let suppliers: { id: string; name: string }[] = [];
  let salesPeople: { id: string; name: string }[] = [];

  try {
    const [o, s] = await Promise.all([
      fetchVerificationOrders(),
      fetchSuppliersWithSchedules(),
    ]);
    orders = o;
    suppliers = s.map((x) => ({ id: x.id, name: x.name }));
    salesPeople = await fetchSalesPeople();
  } catch {
    /* empty */
  }

  return (
    <>
      <PageHeader
        badge={
          orders.length > 0 ? (
            <Badge variant="warning" className="mb-2">
              {orders.length} do uzupełnienia
            </Badge>
          ) : undefined
        }
        title="Weryfikacja zgłoszeń"
        description="Niekompletne prośby handlowców — uzupełnij dostawcę i produkt. Możesz też otworzyć weryfikację z panelu dziennego (pasek przy prośbach)."
      />
      <VerificationClient
        orders={orders}
        suppliers={suppliers}
        salesPeople={salesPeople.map((p) => ({ id: p.id, name: p.name }))}
      />
    </>
  );
}
