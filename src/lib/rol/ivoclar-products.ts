/**
 * Towary Ivoclar dla skanu ROL (decyzja P4: cały Ivoclar, łącznie z zębami):
 * zakresy Kreatora dostawców z „Ivoclar” w nazwie (cecha albo grupa) + zęby z producentem `ivoclar`.
 */
import { query } from "@/lib/db/pool";
import { listZdEstimateSupplierScopesFor } from "@/lib/data/zd-estimate-supplier-scopes";
import { searchSubiektOrdersProducts } from "@/lib/subiekt/api";

const PAGE_SIZE = 200;

export async function loadIvoclarTwIds(): Promise<Set<number>> {
  const suppliers = await query<{ id: string }>(`SELECT id FROM suppliers WHERE name ILIKE '%ivoclar%'`);
  const scopes = (await Promise.all(suppliers.rows.map((s) => listZdEstimateSupplierScopesFor(s.id)))).flat();
  if (!scopes.length) {
    throw new Error("Dostawca Ivoclar nie ma zakresu w Kreatorze ZD (cecha albo grupa) — ustaw go w karcie dostawcy.");
  }
  const out = new Set<number>();
  for (const scope of scopes) {
    const filter = scope.mode === "cecha" ? { cechaId: scope.cechaId ?? undefined } : { grupaId: scope.grupaId ?? undefined };
    let page = 1;
    let totalPages = 1;
    do {
      const res = await searchSubiektOrdersProducts({ ...filter, page, pageSize: PAGE_SIZE });
      for (const p of res.data ?? []) {
        const id = Math.trunc(Number(p.tw_Id));
        if (id > 0) out.add(id);
      }
      totalPages = Math.max(1, Math.trunc(Number(res.pagination?.totalPages) || 1));
      page += 1;
    } while (page <= totalPages);
  }
  const teeth = await query<{ id: number }>(
    `SELECT subiekt_tw_id AS id FROM prosba_teeth_products WHERE lower(manufacturer) = 'ivoclar'`
  );
  for (const r of teeth.rows) out.add(Math.trunc(Number(r.id)));
  return out;
}
