/**
 * Odczyt i zapis cen w Subiekcie dla cenników — host `SUBIEKT_API_BASE_URL` (:5080 live / :5082 test).
 *
 * Zapis: gdy API ma `PUT /price/catalog/levels/{level}`, kartotekowa i detaliczna idą dokładnie
 * (SQL, bez Sfery). Bez niego — tylko kartotekowa przez Sferę, a detaliczną Subiekt przelicza narzutem
 * (może odejść o grosze; weryfikacja po zapisie to pokaże).
 */

import { query } from "@/lib/db/pool";
import { subiektJson } from "@/lib/subiekt/client";
import {
  resolveSubiektPricesConfig,
  SUBIEKT_ORDERS_LIVE_PORT,
  SUBIEKT_ORDERS_TEST_PORT,
  zdEstimateOrdersHostLabel,
  zdEstimateSnapshotHostKind,
  type SubiektConfig,
  type ZdEstimateSnapshotHostKind,
} from "@/lib/subiekt/config";
import { SUBIEKT_PATHS } from "@/lib/subiekt/paths";
import { subiektQueryString } from "@/lib/subiekt/query";
import type {
  SubiektListEnvelope,
  SubiektProduct,
  SubiektProductCecha,
  SubiektSingleEnvelope,
} from "@/lib/subiekt/types";

export type PricesHost = {
  config: SubiektConfig;
  hostKind: ZdEstimateSnapshotHostKind;
  label: string;
};

/** Przełącznik admina w Cennikach (app_settings); brak wpisu = port z SUBIEKT_API_BASE_URL. */
export const PRICES_HOST_SETTING_KEY = "price_lists_host";

async function pricesHostOverride(): Promise<ZdEstimateSnapshotHostKind | null> {
  try {
    const { rows } = await query<{ value: { kind?: unknown } | null }>(
      `SELECT value FROM public.app_settings WHERE key = $1`,
      [PRICES_HOST_SETTING_KEY]
    );
    const kind = rows[0]?.value?.kind;
    return kind === "live" || kind === "orders_test" ? kind : null;
  } catch (e) {
    console.error("pricesHostOverride:", e);
    return null;
  }
}

export async function getPricesHost(): Promise<{ ok: true; host: PricesHost } | { ok: false; error: string }> {
  const resolved = resolveSubiektPricesConfig();
  if (!resolved.ok) return { ok: false, error: resolved.message };
  const override = await pricesHostOverride();
  if (override) {
    // Ten sam serwer Subiekta, inny port: :5080 live / :5082 test.
    const url = new URL(resolved.config.baseUrl);
    url.port = String(override === "live" ? SUBIEKT_ORDERS_LIVE_PORT : SUBIEKT_ORDERS_TEST_PORT);
    resolved.config = { ...resolved.config, baseUrl: url.origin + url.pathname.replace(/\/$/, "") };
  }
  const hostKind = zdEstimateSnapshotHostKind(resolved.config.baseUrl);
  if (!hostKind) return { ok: false, error: "Nieznany host cen Subiekta." };
  return {
    ok: true,
    host: { config: resolved.config, hostKind, label: zdEstimateOrdersHostLabel(resolved.config.baseUrl) },
  };
}

const PAGE_SIZE = 200;
const MAX_PAGES = 100;

async function listAll<T>(cfg: SubiektConfig, path: string, params: Record<string, string | number>): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await subiektJson<SubiektListEnvelope<T>>(
      `${path}${subiektQueryString({ ...params, page, pageSize: PAGE_SIZE })}`,
      {},
      cfg
    );
    out.push(...(res.data ?? []));
    const total = res.pagination?.totalPages ?? 1;
    if (page >= total) return out;
  }
  throw new Error(`Ponad ${MAX_PAGES * PAGE_SIZE} pozycji w ${path} — przerwano odczyt.`);
}

export async function searchPriceCechy(cfg: SubiektConfig, search: string): Promise<SubiektProductCecha[]> {
  const res = await subiektJson<SubiektListEnvelope<SubiektProductCecha>>(
    `${SUBIEKT_PATHS.cechyTowarow}${subiektQueryString({ search: search.trim() || undefined, pageSize: 50 })}`,
    {},
    cfg
  );
  return res.data ?? [];
}

export function fetchCechaProducts(cfg: SubiektConfig, cechaId: number): Promise<SubiektProduct[]> {
  return listAll<SubiektProduct>(cfg, SUBIEKT_PATHS.products, { cechaId });
}

type PriceListItem = { tw_Id: number; vat?: { vat_Stawka?: number | null } | null };

/** Stawka VAT sprzedaży per towar (`GET /products/prices`). */
export async function fetchCechaVat(cfg: SubiektConfig, cechaId: number): Promise<Map<number, number>> {
  const rows = await listAll<PriceListItem>(cfg, "/products/prices", { cechaId });
  const out = new Map<number, number>();
  for (const r of rows) {
    const v = Number(r.vat?.vat_Stawka);
    if (Number.isFinite(v)) out.set(r.tw_Id, v);
  }
  return out;
}

type CatalogLevel = { level: number; name?: string | null; netto: number | null; brutto: number | null };
type CatalogData = { tw_Id: number; levels?: CatalogLevel[] };

export type SubiektPrices = { purchase: number | null; retail: number | null };

export const RETAIL_LEVEL = 4;

/** Kartotekowa (0) i detaliczna (4) — `GET /products/{id}/price/catalog`. */
export async function readPrices(cfg: SubiektConfig, twId: number): Promise<SubiektPrices> {
  const res = await subiektJson<SubiektSingleEnvelope<CatalogData>>(`/products/${twId}/price/catalog`, {}, cfg);
  const levels = res.data?.levels ?? [];
  // Poziom 4 to „detaliczna” w tej firmie; inna nazwa = inna konfiguracja Subiekta, nie zgadujemy.
  const name = levels.find((l) => l.level === RETAIL_LEVEL)?.name;
  if (name && !/detal/i.test(name)) {
    throw new Error(`Poziom ceny ${RETAIL_LEVEL} w Subiekcie to „${name}”, nie detaliczna — zapis cennika wstrzymany.`);
  }
  const at = (n: number) => {
    const v = levels.find((l) => l.level === n)?.netto;
    return v == null ? null : Number(v);
  };
  return { purchase: at(0), retail: at(RETAIL_LEVEL) };
}

/** Ceny wielu towarów; pojedynczy błąd (po jednej powtórce) trafia do `errors`, reszta się czyta. */
export async function readPricesMany(
  cfg: SubiektConfig,
  ids: number[],
  concurrency = 8
): Promise<{ prices: Map<number, SubiektPrices>; errors: Map<number, string> }> {
  const prices = new Map<number, SubiektPrices>();
  const errors = new Map<number, string>();
  let next = 0;
  async function worker() {
    while (next < ids.length) {
      const id = ids[next++]!;
      try {
        prices.set(id, await readPrices(cfg, id).catch(() => readPrices(cfg, id)));
      } catch (e) {
        errors.set(id, e instanceof Error ? e.message : String(e));
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, worker));
  return { prices, errors };
}

type ExamplesEnvelope = { data?: { endpoints?: { method?: string; path?: string }[] } };

const exactEndpoint = new Map<string, { at: number; value: boolean }>();

/**
 * Czy API ma `PUT /products/{id}/price/catalog/levels/{level}` (netto poziomu sprzedaży bez Sfery)
 * — sprawdzane w jego własnym katalogu `/examples`. Na :5082 od 06.10.2026, na :5080 jeszcze nie.
 */
export async function hasExactPricesEndpoint(cfg: SubiektConfig): Promise<boolean> {
  // Per host: po przełączeniu test ↔ live nie wolno użyć odpowiedzi drugiego Subiekta.
  const cached = exactEndpoint.get(cfg.baseUrl);
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.value;
  const res = await subiektJson<ExamplesEnvelope>(SUBIEKT_PATHS.examples, {}, cfg);
  const value = (res.data?.endpoints ?? []).some(
    (e) => e.method?.toUpperCase() === "PUT" && /\/products\/\{id\}\/price\/catalog\/levels\/\{level\}$/.test(e.path ?? "")
  );
  exactEndpoint.set(cfg.baseUrl, { at: Date.now(), value });
  return value;
}

/**
 * Zapis jednej pozycji.
 * `exact`: kartotekowa przez SQL (`PUT /price/catalog`, z brutto z VAT), potem detaliczna wprost
 * (`PUT /price/catalog/levels/4 { netto }`) — Subiekt liczy narzut i marżę od nowej kartotekowej.
 * Bez `exact`: tylko kartotekowa przez Sferę, detaliczna z narzutu towaru (może odejść o grosze).
 */
export async function writePrices(
  cfg: SubiektConfig,
  twId: number,
  prices: SubiektPrices,
  current: SubiektPrices,
  exact: boolean
): Promise<void> {
  if (exact) {
    if (prices.purchase != null) {
      await subiektJson(`/products/${twId}/price/catalog`, {
        method: "PUT",
        body: JSON.stringify({ catalogPrice: prices.purchase, recalculatePrices: true }),
      }, cfg);
    }
    // Sama zmiana kartotekowej zostawia stary narzut/marżę detalicznej — zapis netto przelicza je od nowa.
    const retail = prices.retail ?? current.retail;
    if (retail != null) {
      await subiektJson(`/products/${twId}/price/catalog/levels/${RETAIL_LEVEL}`, {
        method: "PUT",
        body: JSON.stringify({ netto: retail }),
      }, cfg);
    }
    return;
  }
  if (prices.purchase == null) {
    throw new Error("API nie umie zapisać samej ceny detalicznej na tym hoście (brak PUT /price/catalog/levels).");
  }
  await subiektJson(`/products/${twId}/price/catalog?use_sfera=true`, {
    method: "PUT",
    body: JSON.stringify({ catalogPrice: prices.purchase, recalculatePrices: true }),
  }, cfg);
}
