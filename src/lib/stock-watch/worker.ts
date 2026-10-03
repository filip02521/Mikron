/**
 * Nocny worker „Braki i zamówienia”.
 *
 * 1. Ceny zakupu z ZD (lokalny indeks z synchronizacji katalogu) — porcja na noc.
 * 2. Dla każdego zakresu dostawcy (grupa / cecha z kreatora ZD) dwa odczyty
 *    GET /orders/zd/estimate: sprzedaż 30 i 60 dni (+ stany, rezerwacje, otwarte ZD/ZK).
 * 3. Analiza (rotacja, dni do wyczerpania, bufor, propozycja) → stock_watch_items.
 *
 * Tylko odczyt z Subiekta. Limit czasu: niedokończone zakresy przechodzą
 * do kolejnego wywołania crona tego samego dnia.
 */

import { subDays } from "date-fns";
import { getPool } from "@/lib/db/pool";
import { fetchSuppliersWithSchedules } from "@/lib/data/queries";
import { listZdEstimateSupplierScopes } from "@/lib/data/zd-estimate-supplier-scopes";
import { fetchZdEstimatePackaging } from "@/lib/data/zd-estimate-packaging";
import { fetchZdEstimateMinStock } from "@/lib/data/zd-estimate-min-stock";
import { fetchZdEstimateExclusions } from "@/lib/data/zd-estimate-exclusions";
import { fetchZdEstimateOnRequests } from "@/lib/data/zd-estimate-on-request";
import {
  fetchSubiektOrdersLatestFsDateKey,
  fetchSubiektZdEstimateAll,
} from "@/lib/subiekt/api";
import { resolveSubiektOrdersConfig } from "@/lib/subiekt/config";
import { assertZdEstimateFilterEcho } from "@/lib/orders/zd-estimate-scope";
import { stockPeriodToDniZapasu } from "@/lib/orders/zd-estimate-manual";
import { formatDateString, parseDateOnly } from "@/lib/orders/dates";
import { warsawNowParts } from "@/lib/time/warsaw";
import { userFacingErrorTextFromMessage } from "@/lib/ui/user-facing-error";
import type { SubiektZdEstimateLine } from "@/lib/subiekt/types";
import {
  analyzeStockWatchItem,
  STOCK_WATCH_DEFAULT_BUFFER_DAYS,
  type StockWatchPackaging,
  type StockWatchRule,
} from "@/lib/stock-watch/analysis";
import {
  createStockWatchRun,
  getLatestStockWatchRun,
  loadProductPurchasePrices,
  pruneStaleStockWatchItems,
  releaseStockWatchAdvisoryLock,
  tryStockWatchAdvisoryLock,
  updateStockWatchRun,
  upsertStockWatchItems,
  type StockWatchItemWrite,
  type StockWatchRun,
  type StockWatchScopeFailure,
} from "@/lib/stock-watch/data";
import { harvestZdPurchasePrices } from "@/lib/stock-watch/price-harvest";

/** Budżet jednego wywołania crona (route ma maxDuration 900 s). */
export const STOCK_WATCH_CRON_BUDGET_MS = 12 * 60 * 1000;

/** Część budżetu na ceny — reszta na zakresy (ważniejsze). */
const PRICE_HARVEST_BUDGET_SHARE = 0.25;

/** Zapas na zapis wyników po ostatnim zakresie. */
const SCOPE_SAFETY_MS = 90_000;

/** Wyniki dostawców bez zakresu znikają z panelu po tylu dniach. */
const STALE_ITEM_DAYS = 7;

/** Okno nocne (Warszawa) — po synchronizacji katalogu (1:00–4:59). */
export function isWarsawStockWatchWindow(date = new Date()): boolean {
  const { hour } = warsawNowParts(date);
  return hour >= 5 && hour <= 6;
}

export type StockWatchWorkerResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  runId?: string;
  status?: StockWatchRun["status"];
  scopesTotal?: number;
  scopesDone?: number;
  scopesFailed?: number;
  itemsWritten?: number;
  pricesUpdated?: number;
  priceDocs?: number;
  timedOut?: boolean;
  error?: string;
};

type MergedLine = {
  base: SubiektZdEstimateLine;
  sales30d: number;
  sales60d: number;
};

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** 30 dni daje stany i ruch; 60 dni tylko sprzedaż do średniej ważonej. */
export function mergeEstimateWindows(
  lines30: readonly SubiektZdEstimateLine[],
  lines60: readonly SubiektZdEstimateLine[]
): MergedLine[] {
  const byTw = new Map<number, MergedLine>();
  for (const line of lines30) {
    const tw = Math.trunc(Number(line.tw_Id));
    if (!(tw > 0) || byTw.has(tw)) continue;
    byTw.set(tw, { base: line, sales30d: num(line.sprzedazOkres), sales60d: 0 });
  }
  for (const line of lines60) {
    const tw = Math.trunc(Number(line.tw_Id));
    if (!(tw > 0)) continue;
    const hit = byTw.get(tw);
    if (hit) {
      hit.sales60d = num(line.sprzedazOkres);
    } else {
      // Brak w oknie 30 dni (rzadkie) — stany z okna 60 dni, sprzedaż 30 = 0.
      byTw.set(tw, { base: line, sales30d: 0, sales60d: num(line.sprzedazOkres) });
    }
  }
  return [...byTw.values()];
}

async function resolveSalesEndDate(todayKey: string): Promise<string> {
  const today = parseDateOnly(todayKey)!;
  const yesterday = formatDateString(subDays(today, 1));
  try {
    const latestFs = await fetchSubiektOrdersLatestFsDateKey();
    // Kopia bazy bywa starsza niż „wczoraj” — nie licz dni bez danych jako zerowej sprzedaży.
    if (latestFs && latestFs < yesterday) return latestFs;
  } catch {
    /* fallback: wczoraj */
  }
  return yesterday;
}

export async function runStockWatchWorker(input: {
  trigger: "cron" | "manual";
  force?: boolean;
  budgetMs?: number;
}): Promise<StockWatchWorkerResult> {
  const startedMs = Date.now();
  const deadlineMs = startedMs + (input.budgetMs ?? STOCK_WATCH_CRON_BUDGET_MS);

  const orders = resolveSubiektOrdersConfig();
  if (!orders.ok) {
    return { ok: false, reason: "subiekt_not_configured", error: orders.message };
  }

  const client = await getPool().connect();
  let locked = false;
  try {
    locked = await tryStockWatchAdvisoryLock(client);
    if (!locked) return { ok: true, skipped: true, reason: "lock_held" };

    const todayKey = warsawNowParts().dateKey;
    const [scopes, suppliers] = await Promise.all([
      listZdEstimateSupplierScopes(),
      fetchSuppliersWithSchedules(undefined, { activeOnly: true }),
    ]);
    const supplierById = new Map(suppliers.map((s) => [s.id, s]));
    const activeScopes = scopes.filter((s) => supplierById.has(s.supplierId));

    let run = await getLatestStockWatchRun(todayKey);
    const pendingIn = (r: StockWatchRun) =>
      activeScopes.filter((s) => !r.scopesDone.includes(s.supplierId));

    if (run && !input.force && run.status !== "running" && pendingIn(run).length === 0) {
      return { ok: true, skipped: true, reason: "already_done_today", runId: run.id };
    }
    if (!run || input.force) {
      run = await createStockWatchRun({
        runDate: todayKey,
        triggerKind: input.trigger,
        salesEndDate: await resolveSalesEndDate(todayKey),
        scopesTotal: activeScopes.length,
      });
    } else {
      await updateStockWatchRun(run.id, {
        status: "running",
        scopesTotal: activeScopes.length,
      });
    }

    // 1) Ceny — ograniczona porcja, żeby zakresy zawsze miały czas.
    const priceDeadline = Math.min(
      deadlineMs - SCOPE_SAFETY_MS,
      startedMs + (deadlineMs - startedMs) * PRICE_HARVEST_BUDGET_SHARE
    );
    let priceDocs = 0;
    let pricesUpdated = 0;
    try {
      const harvest = await harvestZdPurchasePrices({ deadlineMs: priceDeadline });
      priceDocs = harvest.docsProcessed;
      pricesUpdated = harvest.pricesUpdated;
    } catch (e) {
      console.error("[stock-watch] price harvest", e);
    }

    // 2) Reguły i ustawienia — raz na wywołanie.
    const [packagingRows, minStockRows, exclusions, onRequests, prices] =
      await Promise.all([
        fetchZdEstimatePackaging(),
        fetchZdEstimateMinStock(),
        fetchZdEstimateExclusions(),
        fetchZdEstimateOnRequests(),
        loadProductPurchasePrices(),
      ]);
    const packagingByTw = new Map<number, StockWatchPackaging>(
      packagingRows.map((p) => [
        p.subiektTwId,
        { unitsPerPackage: p.unitsPerPackage, documentUnitMode: p.documentUnitMode },
      ])
    );
    const minStockByTw = new Map(minStockRows.map((m) => [m.subiektTwId, m.minStockSzt]));
    const excluded = new Set(exclusions.map((e) => e.subiektTwId));
    const onRequest = new Set(onRequests.map((r) => r.subiektTwId));
    const ruleFor = (tw: number): StockWatchRule =>
      excluded.has(tw) ? "excluded" : onRequest.has(tw) ? "on_request" : "standard";

    const salesEnd = parseDateOnly(run.salesEndDate)!;
    const window30 = {
      dataOd: formatDateString(subDays(salesEnd, 29)),
      dataDo: run.salesEndDate,
    };
    const window60 = {
      dataOd: formatDateString(subDays(salesEnd, 59)),
      dataDo: run.salesEndDate,
    };

    // 3) Zakresy dostawców.
    const scopesDone = [...run.scopesDone];
    const scopesFailed: StockWatchScopeFailure[] = [...run.scopesFailed];
    let itemsWritten = run.itemsWritten;
    let timedOut = false;

    for (const scope of pendingIn(run)) {
      if (Date.now() > deadlineMs - SCOPE_SAFETY_MS) {
        timedOut = true;
        break;
      }
      const supplier = supplierById.get(scope.supplierId)!;
      const bufferDays =
        stockPeriodToDniZapasu(
          supplier.stock_raw,
          supplier.stock != null ? Number(supplier.stock) : null
        ) ?? STOCK_WATCH_DEFAULT_BUFFER_DAYS;
      const filter =
        scope.mode === "grupa"
          ? { grupaId: scope.grupaId ?? undefined }
          : { cechaId: scope.cechaId ?? undefined };
      const validateFirstPage = ({
        parametry,
      }: {
        parametry: { grupaId?: unknown; cechaId?: unknown };
      }) =>
        assertZdEstimateFilterEcho({
          mode: scope.mode,
          expectedGrupaId: scope.grupaId,
          expectedCechaId: scope.cechaId,
          parametry,
        });

      try {
        const est30 = await fetchSubiektZdEstimateAll(
          { ...filter, ...window30, dniZapasu: bufferDays, tylkoBraki: false },
          { validateFirstPage }
        );
        const est60 = await fetchSubiektZdEstimateAll(
          { ...filter, ...window60, dniZapasu: bufferDays, tylkoBraki: false },
          { validateFirstPage }
        );

        const rows: StockWatchItemWrite[] = mergeEstimateWindows(
          est30.pozycje,
          est60.pozycje
        ).map(({ base, sales30d, sales60d }) => {
          const tw = Math.trunc(Number(base.tw_Id));
          const packaging = packagingByTw.get(tw) ?? null;
          const minStock = minStockByTw.get(tw) ?? null;
          const rule = ruleFor(tw);
          const result = analyzeStockWatchItem({
            stockQty: num(base.tw_Stan),
            reservedQty: num(base.tw_StanRez),
            availableQty: num(base.dostepne),
            openZdDocUnits: num(base.otwarteZd),
            openZkUnreservedQty: num(base.otwarteZkBezRez),
            sales30d,
            sales60d,
            bufferDays,
            minStockQty: minStock,
            rule,
            packaging,
            lastZdPriceNet: prices.get(tw)?.priceNet ?? null,
            salesEndDate: run!.salesEndDate,
          });
          return {
            subiektTwId: tw,
            supplierId: scope.supplierId,
            runId: run!.id,
            twSymbol: base.tw_Symbol ?? null,
            twNazwa: String(base.tw_Nazwa ?? "").trim(),
            grtNazwa: base.grt_Nazwa ?? null,
            scopeMode: scope.mode,
            scopeId: (scope.mode === "grupa" ? scope.grupaId : scope.cechaId) ?? 0,
            stockQty: num(base.tw_Stan),
            reservedQty: num(base.tw_StanRez),
            availableQty: num(base.dostepne),
            openZdQty: result.openZdQty,
            openZkUnreservedQty: num(base.otwarteZkBezRez),
            sales30d,
            sales60d,
            velocityDaily: result.velocityDaily,
            velocityTrend: result.velocityTrend,
            daysOfCover: result.daysOfCover,
            runOutDate: result.runOutDate,
            bufferDays: result.bufferDays,
            safetyStockQty: result.safetyStockQty,
            minStockQty: minStock,
            suggestedQty: result.suggestedQty,
            unitPriceNet: result.unitPriceNet,
            dailyValue: result.dailyValue,
            status: result.status,
          };
        });

        itemsWritten += await upsertStockWatchItems(rows);
        if (est30.truncated || est60.truncated) {
          scopesFailed.push({
            supplierId: scope.supplierId,
            supplierName: supplier.name,
            message: "Lista z Subiekta niepełna (limit stron) — część towarów pominięta.",
          });
        }
      } catch (e) {
        const message = userFacingErrorTextFromMessage(
          e instanceof Error ? e.message : String(e)
        );
        console.error("[stock-watch] scope", scope.supplierId, message);
        scopesFailed.push({
          supplierId: scope.supplierId,
          supplierName: supplier.name,
          message,
        });
      }
      // Także po błędzie — bez pętli na tym samym zakresie do końca dnia.
      scopesDone.push(scope.supplierId);
      await updateStockWatchRun(run.id, { scopesDone, scopesFailed, itemsWritten });
    }

    await pruneStaleStockWatchItems(STALE_ITEM_DAYS);

    const status: StockWatchRun["status"] = timedOut
      ? "partial"
      : scopesFailed.length > 0
        ? "partial"
        : "ok";
    await updateStockWatchRun(run.id, {
      status,
      scopesDone,
      scopesFailed,
      itemsWritten,
      pricesUpdated: run.pricesUpdated + pricesUpdated,
      finished: !timedOut,
      detail: {
        ...run.detail,
        lastInvocationMs: Date.now() - startedMs,
        timedOut,
        priceDocsLastInvocation: priceDocs,
      },
    });

    return {
      ok: true,
      runId: run.id,
      status,
      scopesTotal: activeScopes.length,
      scopesDone: scopesDone.length,
      scopesFailed: scopesFailed.length,
      itemsWritten,
      pricesUpdated,
      priceDocs,
      timedOut,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[stock-watch] worker", e);
    return { ok: false, error: message };
  } finally {
    if (locked) {
      await releaseStockWatchAdvisoryLock(client).catch(() => undefined);
    }
    client.release();
  }
}
