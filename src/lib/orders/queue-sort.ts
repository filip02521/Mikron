import type { IndividualOrder } from "@/types/database";

function supplierLabel(order: IndividualOrder): string {
  return order.supplier?.name?.trim() || "zzz";
}

/** Kolejka realizacji: alfabetycznie po dostawcy, potem handlowiec, potem data zgłoszenia. */
export function compareIndividualOrdersBySupplier(
  a: IndividualOrder,
  b: IndividualOrder
): number {
  const bySupplier = supplierLabel(a).localeCompare(supplierLabel(b), "pl", {
    sensitivity: "base",
  });
  if (bySupplier !== 0) return bySupplier;

  const pa = a.sales_person?.name?.trim() ?? "";
  const pb = b.sales_person?.name?.trim() ?? "";
  const byPerson = pa.localeCompare(pb, "pl", { sensitivity: "base" });
  if (byPerson !== 0) return byPerson;

  return new Date(a.action_at).getTime() - new Date(b.action_at).getTime();
}

export function sortIndividualOrdersBySupplier(
  orders: IndividualOrder[]
): IndividualOrder[] {
  return [...orders].sort(compareIndividualOrdersBySupplier);
}
