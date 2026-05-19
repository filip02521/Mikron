import type { SupplierLocation, SupplierWithSchedule } from "@/types/database";

export const SUPPLIER_LOCATION_OPTIONS: {
  value: SupplierLocation;
  label: string;
}[] = [
  { value: "POLSKA", label: "Polska" },
  { value: "ZAGRANICA", label: "Zagranica" },
  { value: "IMPORT", label: "Import" },
];

export type SupplierLocationFilter = "all" | SupplierLocation;

export type SupplierLocationCounts = Record<SupplierLocationFilter, number>;

export function countSuppliersByLocation(
  suppliers: Pick<SupplierWithSchedule, "location">[]
): SupplierLocationCounts {
  const counts: SupplierLocationCounts = {
    all: suppliers.length,
    POLSKA: 0,
    ZAGRANICA: 0,
    IMPORT: 0,
  };
  for (const s of suppliers) {
    counts[s.location]++;
  }
  return counts;
}

export function filterSuppliersForAdmin(
  suppliers: SupplierWithSchedule[],
  locationFilter: SupplierLocationFilter,
  search: string
): SupplierWithSchedule[] {
  let list = suppliers;
  if (locationFilter !== "all") {
    list = list.filter((s) => s.location === locationFilter);
  }
  const q = search.trim().toLowerCase();
  if (q) {
    list = list.filter((s) => s.name.toLowerCase().includes(q));
  }
  return list;
}
