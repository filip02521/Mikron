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

export type SupplierSubiektFilter = "all" | "unlinked" | "linked";

export type SupplierSubiektCounts = Record<SupplierSubiektFilter, number>;

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

export function countSuppliersBySubiektLink(
  suppliers: Pick<SupplierWithSchedule, "subiekt_kh_id">[]
): SupplierSubiektCounts {
  let unlinked = 0;
  for (const s of suppliers) {
    if (s.subiekt_kh_id == null) unlinked++;
  }
  const total = suppliers.length;
  return { all: total, unlinked, linked: total - unlinked };
}

export function filterSuppliersForAdmin(
  suppliers: SupplierWithSchedule[],
  locationFilter: SupplierLocationFilter,
  search: string,
  subiektFilter: SupplierSubiektFilter = "all",
  sortUnlinkedFirst = false
): SupplierWithSchedule[] {
  let list = suppliers;
  if (locationFilter !== "all") {
    list = list.filter((s) => s.location === locationFilter);
  }
  if (subiektFilter === "unlinked") {
    list = list.filter((s) => s.subiekt_kh_id == null);
  } else if (subiektFilter === "linked") {
    list = list.filter((s) => s.subiekt_kh_id != null);
  }
  const q = search.trim().toLowerCase();
  if (q) {
    list = list.filter((s) => s.name.toLowerCase().includes(q));
  }
  if (sortUnlinkedFirst) {
    list = [...list].sort((a, b) => {
      const aUnlinked = a.subiekt_kh_id == null ? 0 : 1;
      const bUnlinked = b.subiekt_kh_id == null ? 0 : 1;
      if (aUnlinked !== bUnlinked) return aUnlinked - bUnlinked;
      return a.name.localeCompare(b.name, "pl");
    });
  }
  return list;
}
