import {
  getSubiektKontrahent,
  searchSubiektCustomers,
  searchSubiektKontrahenci,
  searchSubiektSuppliers,
} from "@/lib/subiekt/api";
import type { SubiektKontrahent } from "@/lib/subiekt/types";

function pickByKhId(rows: SubiektKontrahent[] | undefined, kh: number): SubiektKontrahent | null {
  for (const row of rows ?? []) {
    if (Math.trunc(Number(row.kh_Id)) === kh) return row;
  }
  return null;
}

/** Pojedynczy kontrahent po kh_Id — GET lub lista z filtrem id. */
export async function lookupSubiektKontrahentByKhId(
  khId: number
): Promise<SubiektKontrahent | null> {
  const kh = Math.trunc(khId);
  if (!Number.isFinite(kh) || kh <= 0) return null;

  try {
    return await getSubiektKontrahent(kh);
  } catch {
    /* GET /kontrahenci/:id czasem niedostępny — lista z id= */
  }

  const listSearches = [
    () => searchSubiektKontrahenci({ id: kh, pageSize: 10, page: 1 }),
    () => searchSubiektSuppliers({ id: kh, pageSize: 10, page: 1 }),
    () => searchSubiektCustomers({ id: kh, pageSize: 10, page: 1 }),
  ];

  for (const run of listSearches) {
    try {
      const res = await run();
      const hit = pickByKhId(res.data, kh);
      if (hit) return hit;
    } catch {
      /* kolejna ścieżka */
    }
  }

  return null;
}
