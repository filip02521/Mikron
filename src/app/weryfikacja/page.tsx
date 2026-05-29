import {
  fetchSuppliersWithSchedules,
  fetchVerificationOrders,
} from "@/lib/data/queries";
import { fetchSalesPeopleForPicker } from "@/lib/data/sales-people-admin";
import { VerificationClient } from "@/components/verification/VerificationClient";
import type { IndividualOrder } from "@/types/database";

export default async function WeryfikacjaPage() {
  let orders: IndividualOrder[] = [];
  let suppliers: { id: string; name: string }[] = [];
  let salesPeople: { id: string; name: string }[] = [];

  try {
    const [o, s] = await Promise.all([
      fetchVerificationOrders(),
      fetchSuppliersWithSchedules(undefined, { activeOnly: false }),
    ]);
    orders = o;
    suppliers = s.map((x) => ({
      id: x.id,
      name: x.name,
      subiekt_kh_id: x.subiekt_kh_id ?? null,
    }));
    salesPeople = await fetchSalesPeopleForPicker();
  } catch {
    /* empty */
  }

  return (
    <VerificationClient
      orders={orders}
      suppliers={suppliers}
      salesPeople={salesPeople.map((p) => ({ id: p.id, name: p.name }))}
    />
  );
}
