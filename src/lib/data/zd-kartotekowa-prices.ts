/**
 * Cena kartotekowa netto (poziom 0) z Subiekta — cena zakupu propozycji ZD automatu (decyzja Filipa
 * 2026-10-23). Tylko GET `/products/{id}/price/catalog` na hoście kreatora ZD (ten Subiekt, w którym
 * powstanie ZD). Jednostka = jednostka dokumentu ZD, jak cena z ostatniego ZD (sprawdzone na :5080
 * 23.10.2026: kartotekowa = cena ostatniego ZD także dla towarów zamawianych w opakowaniach).
 * Tylko serwer.
 */
import { subiektJson } from "@/lib/subiekt/client";
import { resolveSubiektOrdersConfig } from "@/lib/subiekt/config";
import type { SubiektSingleEnvelope } from "@/lib/subiekt/types";

type CatalogData = { levels?: { level: number; netto: number | null }[] | null };

/** Pamięć na przebieg: nocny przebieg i „Przelicz” zaraz po nim nie pytają drugi raz. */
const TTL_MS = 30 * 60_000;
const cache = new Map<string, { at: number; netto: number | null }>();

/**
 * twId → kartotekowa netto (> 0). Brak ceny albo błąd pojedynczego towaru → brak klucza (fallback
 * robi wołający). Brak hosta kreatora → wyjątek. `requests` = zapytania do Subiekta (bez pamięci).
 */
export async function readZdKartotekowaPrices(
  twIds: readonly number[],
  concurrency = 8
): Promise<{ prices: Map<number, number>; requests: number; errors: number }> {
  const resolved = resolveSubiektOrdersConfig();
  if (!resolved.ok) throw new Error(resolved.message);
  const cfg = resolved.config;
  const prices = new Map<number, number>();
  const todo: number[] = [];
  for (const id of new Set(twIds)) {
    const hit = cache.get(`${cfg.baseUrl}|${id}`);
    if (hit && Date.now() - hit.at < TTL_MS) {
      if (hit.netto != null) prices.set(id, hit.netto);
    } else todo.push(id);
  }
  let errors = 0;
  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const id = todo[next++]!;
      try {
        const res = await subiektJson<SubiektSingleEnvelope<CatalogData>>(`/products/${id}/price/catalog`, {}, cfg);
        const v = Number(res.data?.levels?.find((l) => l.level === 0)?.netto);
        const netto = Number.isFinite(v) && v > 0 ? v : null;
        cache.set(`${cfg.baseUrl}|${id}`, { at: Date.now(), netto });
        if (netto != null) prices.set(id, netto);
      } catch (e) {
        errors += 1;
        console.warn("[zd-kartotekowa] cena", id, e instanceof Error ? e.message : e);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, todo.length) }, worker));
  return { prices, requests: todo.length, errors };
}
