/**
 * Indeks towar → grupa / cechy z Subiekta (tylko odczyt) — źródło podpowiedzi
 * mapowań zakresów. Nie rozszerza zakresów: Kreator i panel nadal widzą tylko
 * ręcznie przypisane grupy i cechy.
 *
 * Koszt: ~100 stron /products (grupa jest na towarze) + strony /products?cechaId
 * dla każdej cechy (cech ~200). Lokalnie ok. 1–2 min.
 */

import { getPool, query } from "@/lib/db/pool";
import {
  searchSubiektOrdersProducts,
  searchSubiektProductCechy,
  searchSubiektProductGroups,
} from "@/lib/subiekt/api";
import type { SubiektListEnvelope } from "@/lib/subiekt/types";

/** API przycina stronę do 200 niezależnie od pageSize — trzymamy się tego. */
const PAGE_SIZE = 200;
const MAX_PAGES = 500;

export type ScopeIndexSyncResult = {
  ok: boolean;
  products: number;
  groups: number;
  cechy: number;
  durationMs: number;
  error?: string;
  timedOut?: boolean;
};

/** Wszystkie strony listy — koniec, gdy strona krótsza niż PAGE_SIZE. */
async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<SubiektListEnvelope<T>>,
  deadlineMs: number
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    if (Date.now() > deadlineMs) throw new ScopeIndexTimeoutError();
    const res = await fetchPage(page);
    const data = res.data ?? [];
    out.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return out;
}

class ScopeIndexTimeoutError extends Error {
  constructor() {
    super("Przekroczono czas budowy indeksu zakresów.");
  }
}

export async function getScopeIndexSyncedAt(): Promise<string | null> {
  const res = await query<{ at: Date | null }>(
    `SELECT max(synced_at) AS at FROM subiekt_scope_names`
  );
  const at = res.rows[0]?.at;
  return at ? new Date(at).toISOString() : null;
}

/**
 * Pełna przebudowa indeksu. Zapis w jednej transakcji — przy błędzie lub limicie
 * czasu zostaje poprzedni indeks.
 */
export async function syncSubiektScopeIndex(input: {
  deadlineMs: number;
}): Promise<ScopeIndexSyncResult> {
  const started = Date.now();
  try {
    const [groups, cechy] = await Promise.all([
      fetchAllPages(
        (page) => searchSubiektProductGroups({ page, pageSize: PAGE_SIZE }),
        input.deadlineMs
      ),
      fetchAllPages(
        (page) => searchSubiektProductCechy({ page, pageSize: PAGE_SIZE }),
        input.deadlineMs
      ),
    ]);

    const products = await fetchAllPages(
      (page) => searchSubiektOrdersProducts({ page, pageSize: PAGE_SIZE }),
      input.deadlineMs
    );
    const grupaByTw = new Map<number, number | null>();
    for (const p of products) {
      const tw = Math.trunc(Number(p.tw_Id));
      if (!(tw > 0)) continue;
      const g = Math.trunc(Number(p.tw_IdGrupa));
      grupaByTw.set(tw, g > 0 ? g : null);
    }

    const cechyByTw = new Map<number, number[]>();
    const cechaCount = new Map<number, number>();
    for (const cecha of cechy) {
      const cechaId = Math.trunc(Number(cecha.ctw_Id));
      if (!(cechaId > 0)) continue;
      const rows = await fetchAllPages(
        (page) => searchSubiektOrdersProducts({ cechaId, page, pageSize: PAGE_SIZE }),
        input.deadlineMs
      );
      let n = 0;
      for (const p of rows) {
        const tw = Math.trunc(Number(p.tw_Id));
        if (!(tw > 0)) continue;
        const list = cechyByTw.get(tw) ?? [];
        if (!list.includes(cechaId)) list.push(cechaId);
        cechyByTw.set(tw, list);
        n += 1;
      }
      cechaCount.set(cechaId, n);
    }

    const grupaCount = new Map<number, number>();
    for (const g of grupaByTw.values()) {
      if (g != null) grupaCount.set(g, (grupaCount.get(g) ?? 0) + 1);
    }

    const allTw = new Set<number>([...grupaByTw.keys(), ...cechyByTw.keys()]);
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM subiekt_product_scope_index");
      const tws = [...allTw];
      for (let i = 0; i < tws.length; i += 1000) {
        const chunk = tws.slice(i, i + 1000);
        await client.query(
          `INSERT INTO subiekt_product_scope_index (subiekt_tw_id, grupa_id, cecha_ids, synced_at)
           SELECT t.tw, t.g, COALESCE(t.c, '{}'::int[]), now()
             FROM jsonb_to_recordset($1::jsonb) AS t(tw int, g int, c int[])`,
          [
            JSON.stringify(
              chunk.map((tw) => ({
                tw,
                g: grupaByTw.get(tw) ?? null,
                c: cechyByTw.get(tw) ?? [],
              }))
            ),
          ]
        );
      }
      await client.query("DELETE FROM subiekt_scope_names");
      const names = [
        ...groups
          .filter((g) => Math.trunc(Number(g.grt_Id)) > 0)
          .map((g) => ({
            kind: "grupa",
            id: Math.trunc(Number(g.grt_Id)),
            name: String(g.grt_Nazwa ?? "").trim(),
            n: grupaCount.get(Math.trunc(Number(g.grt_Id))) ?? 0,
          })),
        ...cechy
          .filter((c) => Math.trunc(Number(c.ctw_Id)) > 0)
          .map((c) => ({
            kind: "cecha",
            id: Math.trunc(Number(c.ctw_Id)),
            name: String(c.ctw_Nazwa ?? "").trim(),
            n: cechaCount.get(Math.trunc(Number(c.ctw_Id))) ?? 0,
          })),
      ];
      await client.query(
        `INSERT INTO subiekt_scope_names (kind, scope_id, name, product_count, synced_at)
         SELECT t.kind, t.id, t.name, t.n, now()
           FROM jsonb_to_recordset($1::jsonb) AS t(kind text, id int, name text, n int)
         ON CONFLICT (kind, scope_id) DO NOTHING`,
        [JSON.stringify(names)]
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }

    return {
      ok: true,
      products: allTw.size,
      groups: groups.length,
      cechy: cechy.length,
      durationMs: Date.now() - started,
    };
  } catch (e) {
    return {
      ok: false,
      products: 0,
      groups: 0,
      cechy: 0,
      durationMs: Date.now() - started,
      timedOut: e instanceof ScopeIndexTimeoutError,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
