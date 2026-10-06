/**
 * Odczyt i zapis cen w Subiekcie dla cenników — host `SUBIEKT_API_PRICES_BASE_URL` (:5082 test / :5080 live).
 *
 * Zapis: gdy API ma `PUT /products/{id}/prices` (spec: docs/integrations/subiekt-price-update-api.md),
 * ustawiamy kartotekową i detaliczną dokładnie. Bez niego — tylko kartotekowa przez Sferę,
 * a detaliczną Subiekt przelicza narzutem (może odejść o grosze; weryfikacja po zapisie to pokaże).
 */

import { subiektJson } from "@/lib/subiekt/client";
import {
  resolveSubiektPricesConfig,
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

export function getPricesHost(): { ok: true; host: PricesHost } | { ok: false; error: string } {
  const resolved = resolveSubiektPricesConfig();
  if (!resolved.ok) return { ok: false, error: resolved.message };
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

type CatalogLevel = { level: number; netto: number | null; brutto: number | null };
type CatalogData = { tw_Id: number; levels?: CatalogLevel[] };

export type SubiektPrices = { purchase: number | null; retail: number | null };

export const RETAIL_LEVEL = 4;

/** Kartotekowa (0) i detaliczna (4) — `GET /products/{id}/price/catalog`. */
export async function readPrices(cfg: SubiektConfig, twId: number): Promise<SubiektPrices> {
  const res = await subiektJson<SubiektSingleEnvelope<CatalogData>>(`/products/${twId}/price/catalog`, {}, cfg);
  const levels = res.data?.levels ?? [];
  const at = (n: number) => {
    const v = levels.find((l) => l.level === n)?.netto;
    return v == null ? null : Number(v);
  };
  return { purchase: at(0), retail: at(RETAIL_LEVEL) };
}

export async function readPricesMany(
  cfg: SubiektConfig,
  ids: number[],
  concurrency = 8
): Promise<Map<number, SubiektPrices>> {
  const out = new Map<number, SubiektPrices>();
  let next = 0;
  async function worker() {
    while (next < ids.length) {
      const id = ids[next++]!;
      out.set(id, await readPrices(cfg, id));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, worker));
  return out;
}

type ExamplesEnvelope = { data?: { endpoints?: { method?: string; path?: string }[] } };

let exactEndpoint: { at: number; value: boolean } | null = null;

/** Czy API ma już `PUT /products/{id}/prices` — sprawdzane w jego własnym katalogu `/examples`. */
export async function hasExactPricesEndpoint(cfg: SubiektConfig): Promise<boolean> {
  if (exactEndpoint && Date.now() - exactEndpoint.at < 5 * 60_000) return exactEndpoint.value;
  const res = await subiektJson<ExamplesEnvelope>(SUBIEKT_PATHS.examples, {}, cfg);
  const value = (res.data?.endpoints ?? []).some(
    (e) => e.method?.toUpperCase() === "PUT" && /\/products\/\{id\}\/prices$/.test(e.path ?? "")
  );
  exactEndpoint = { at: Date.now(), value };
  return value;
}

/**
 * Zapis jednej pozycji. `exact` = nowy endpoint (obie ceny dokładnie);
 * inaczej tylko kartotekowa przez Sferę z przeliczeniem poziomów.
 */
export async function writePrices(
  cfg: SubiektConfig,
  twId: number,
  prices: SubiektPrices,
  expected: SubiektPrices,
  exact: boolean
): Promise<void> {
  if (exact) {
    const levels: { level: number; netto: number }[] = [];
    const expectedLevels: { level: number; netto: number }[] = [];
    if (prices.purchase != null) levels.push({ level: 0, netto: prices.purchase });
    if (prices.retail != null) levels.push({ level: RETAIL_LEVEL, netto: prices.retail });
    if (expected.purchase != null) expectedLevels.push({ level: 0, netto: expected.purchase });
    if (expected.retail != null) expectedLevels.push({ level: RETAIL_LEVEL, netto: expected.retail });
    await subiektJson(`/products/${twId}/prices`, {
      method: "PUT",
      body: JSON.stringify({ levels, expected: expectedLevels }),
    }, cfg);
    return;
  }
  // ponytail: fallback do czasu wdrożenia PUT /products/{id}/prices — detaliczna z narzutu, nie z cennika.
  if (prices.purchase == null) {
    throw new Error("API nie umie jeszcze zapisać samej ceny detalicznej (brak PUT /products/{id}/prices).");
  }
  await subiektJson(`/products/${twId}/price/catalog?use_sfera=true`, {
    method: "PUT",
    body: JSON.stringify({ catalogPrice: prices.purchase, recalculatePrices: true }),
  }, cfg);
}
