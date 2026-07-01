import type { IndividualOrder, SalesPerson, Supplier } from "@/types/database";
import { parseTeethLineDelivered } from "@/lib/teeth/teeth-receive-picker";

type RawIndividualOrder = IndividualOrder & {
  suppliers?: Supplier | Supplier[] | null;
  sales_people?: SalesPerson | SalesPerson[] | null;
};

function embedFirst<T>(value: T | T[] | null | undefined): T | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

/** Supabase embed używa nazw tabel (suppliers), typy — supplier. */
export function normalizeIndividualOrder(row: RawIndividualOrder): IndividualOrder {
  const supplier = row.supplier ?? embedFirst(row.suppliers);
  const sales_person = row.sales_person ?? embedFirst(row.sales_people);
  return {
    ...row,
    request_kind: row.request_kind ?? "zamowienie",
    teeth_line_delivered: parseTeethLineDelivered(row.teeth_line_delivered),
    supplier,
    sales_person,
  };
}

export function normalizeIndividualOrders(rows: RawIndividualOrder[]): IndividualOrder[] {
  return rows.map(normalizeIndividualOrder);
}
