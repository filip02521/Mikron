/**
 * Nocny worker „Braki i zamówienia”.
 *
 * 1. Ceny zakupu z ZD (lokalny indeks z synchronizacji katalogu) — porcja na noc.
 * 2. Dla każdego dostawcy z zakresem (grupa / cecha) — silnik zamówień ZD,
 *    dokładnie jak „Policz” w Kreatorze (te same dni zapasu, okno sprzedaży, reguły,
 *    historia, prośby) → lista „Do ZD” + sygnały stanów → stock_watch_items.
 *
 * Tylko odczyt z Subiekta. Limit czasu: niedokończone zakresy przechodzą
 * do kolejnego wywołania crona tego samego dnia.
 */

import { getPool } from "@/lib/db/pool";
import { fetchSuppliersWithSchedules } from "@/lib/data/queries";
import {
  groupZdEstimateScopesBySupplier,
  listZdEstimateSupplierScopes,
} from "@/lib/data/zd-estimate-supplier-scopes";
import { fetchSubiektOrdersLatestFsDateKey } from "@/lib/subiekt/api";
import { resolveSubiektOrdersConfig } from "@/lib/subiekt/config";
import {
  DEFAULT_DNI_ZAPASU,
  salesWindowFromDniZapasu,
  stockPeriodToDniZapasu,
} from "@/lib/orders/zd-estimate-manual";
import { ZD_ESTIMATE_UI_PREFS_DEFAULTS } from "@/lib/orders/zd-estimate-prefs";
import { zdDocumentUnitsToPieces } from "@/lib/orders/zd-estimate-units";
import { runZdOrderEngine } from "@/lib/orders/zd-order-engine";
import { buildZdOrderList } from "@/lib/orders/zd-order-list";
import { warsawNowParts } from "@/lib/time/warsaw";
import { userFacingErrorTextFromMessage } from "@/lib/ui/user-facing-error";
import { analyzeStockWatchItem, unitPricePerPiece } from "@/lib/stock-watch/analysis";
import {
  createStockWatchRun,
  getLatestStockWatchRun,
  loadProductPurchasePrices,
  pruneStaleStockWatchItems,
  releaseStockWatchAdvisoryLock,
  replaceSupplierStockWatchItems,
  tryStockWatchAdvisoryLock,
  updateStockWatchRun,
  upsertStockWatchSupplierOrder,
  type ProductPurchasePrice,
  type StockWatchItemWrite,
  type StockWatchRun,
  type StockWatchScopeFailure,
} from "@/lib/stock-watch/data";
import { harvestZdPurchasePrices } from "@/lib/stock-watch/price-harvest";
import { getScopeIndexSyncedAt, syncSubiektScopeIndex } from "@/lib/orders/zd-scope-index";

/** Budżet jednego wywołania crona (route ma maxDuration 900 s). */
export const STOCK_WATCH_CRON_BUDGET_MS = 12 * 60 * 1000;

/** Część budżetu na ceny — reszta na zakresy (ważniejsze). */
const PRICE_HARVEST_BUDGET_SHARE = 0.25;

/** Zapas na zapis wyników po ostatnim zakresie. */
const SCOPE_SAFETY_MS = 90_000;

/** Wyniki dostawców bez zakresu znikają z panelu po tylu dniach. */
const STALE_ITEM_DAYS = 7;

/** Indeks grup/cech (podpowiedzi zakresów) — przebudowa raz na dobę, ok. 2 min. */
const SCOPE_INDEX_MAX_AGE_MS = 20 * 60 * 60 * 1000;
const SCOPE_INDEX_MIN_TIME_MS = 4 * 60 * 1000;

/** Po dostawcach, jeśli zostało czasu — nie zabiera budżetu listom „Do ZD”. */
async function maybeSyncScopeIndex(deadlineMs: number): Promise<string | null> {
  try {
    const syncedAt = await getScopeIndexSyncedAt();
    if (syncedAt && Date.now() - Date.parse(syncedAt) < SCOPE_INDEX_MAX_AGE_MS) return null;
    if (deadlineMs - Date.now() < SCOPE_INDEX_MIN_TIME_MS) return "skipped_no_time";
    const res = await syncSubiektScopeIndex({ deadlineMs: deadlineMs - 30_000 });
    return res.ok ? "ok" : `failed: ${res.error ?? ""}`.slice(0, 200);
  } catch (e) {
    console.error("[stock-watch] scope index", e);
    return "failed";
  }
}

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

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round(value: number, digits: number): number {
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}

/** Koniec okna sprzedaży jak w Kreatorze: ostatnia FS w Subiekcie, inaczej dziś. */
async function resolveSalesEndDate(todayKey: string): Promise<string> {
  try {
    return (await fetchSubiektOrdersLatestFsDateKey()) ?? todayKey;
  } catch {
    return todayKey;
  }
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
    // Jeden przebieg na dostawcę: zakres główny, silnik dołącza pozostałe zakresy.
    const activeScopes = [...groupZdEstimateScopesBySupplier(scopes).values()]
      .map((list) => list[0]!)
      .filter((s) => supplierById.has(s.supplierId));

    let run = await getLatestStockWatchRun(todayKey);
    const pendingIn = (r: StockWatchRun) =>
      activeScopes.filter((s) => !r.scopesDone.includes(s.supplierId));

    if (run && !input.force && run.status !== "running" && pendingIn(run).length === 0) {
      // Kolejny slot crona: dostawcy policzeni — ewentualnie indeks podpowiedzi.
      await maybeSyncScopeIndex(deadlineMs);
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

    // 2) Wycena listy — raz na wywołanie (reguły czyta silnik per dostawca, jak Kreator).
    const prices = await loadProductPurchasePrices();

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
      try {
        const outcome = await computeSupplierOrder({
          scope,
          supplier,
          run,
          ordersBaseUrl: orders.config.baseUrl,
          prices,
        });
        itemsWritten += outcome.itemsWritten;
        if (outcome.message) {
          scopesFailed.push({
            supplierId: scope.supplierId,
            supplierName: supplier.name,
            message: outcome.message,
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
    const scopeIndex = timedOut ? null : await maybeSyncScopeIndex(deadlineMs);

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
        ...(scopeIndex ? { scopeIndexLastInvocation: scopeIndex } : {}),
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

/**
 * Jeden dostawca: silnik (jak „Policz”) → lista „Do ZD” (jak tabela Kreatora)
 * → zapis pozycji i podsumowania. `message` = częściowy problem do pokazania w panelu.
 */
async function computeSupplierOrder(input: {
  scope: Awaited<ReturnType<typeof listZdEstimateSupplierScopes>>[number];
  supplier: { id: string; name: string; stock_raw: string | null; stock: unknown };
  run: StockWatchRun;
  ordersBaseUrl: string;
  prices: ReadonlyMap<number, ProductPurchasePrice>;
}): Promise<{ itemsWritten: number; message: string | null }> {
  const { scope, supplier, run, prices } = input;
  const scopeId = (scope.mode === "grupa" ? scope.grupaId : scope.cechaId) ?? 0;
  if (!(scopeId > 0)) {
    return { itemsWritten: 0, message: "Zakres dostawcy bez grupy / cechy." };
  }
  // Te same dni zapasu i okno co Kreator po wyborze dostawcy.
  const rawDni = stockPeriodToDniZapasu(
    supplier.stock_raw,
    supplier.stock != null ? Number(supplier.stock) : null
  );
  const dniZapasu = rawDni != null && rawDni > 0 ? rawDni : DEFAULT_DNI_ZAPASU;
  const window = salesWindowFromDniZapasu(dniZapasu, run.salesEndDate);

  const engine = await runZdOrderEngine({
    scope:
      scope.mode === "grupa"
        ? { mode: "grupa", grupaId: scopeId, cechaId: null }
        : { mode: "cecha", grupaId: null, cechaId: scopeId },
    supplierId: supplier.id,
    dniZapasu,
    dataOd: window.dataOd,
    dataDo: window.dataDo,
    zapasMin: ZD_ESTIMATE_UI_PREFS_DEFAULTS.zapasMin,
    ordersBaseUrl: input.ordersBaseUrl,
  });
  if (!engine.ok) {
    return { itemsWritten: 0, message: engine.feedback.message };
  }

  const list = buildZdOrderList({
    lines: engine.result.pozycje,
    packagingLookup: engine.packagingLookup,
    hardExcludedTwIds: engine.hardExcludedTwIds,
    onRequestTwIds: engine.onRequestTwIds,
    productPairs: engine.productPairs,
    bomRefs: engine.bomRefs,
    missingBomTwIds: engine.missingBomTwIds,
    teethTwIds: engine.teethTwIds,
    pendingIndividuals: engine.pendingIndividuals,
    // Jak Workbench po Policz: brak resolve = pusta mapa (bez korekty overlap).
    prosbaReservedByTwId: engine.prosbaReservedByTwId ?? new Map(),
    extrasPolicy: engine.extrasPolicy,
    minStockByTwId: engine.minStockByTwId,
  });
  const orderByTw = new Map(list.lines.map((l) => [l.line.tw_Id, l]));

  let orderValue = 0;
  let unpricedCount = 0;
  let zdUnitsSum = 0;
  const rows: StockWatchItemWrite[] = engine.result.pozycje.map((line) => {
    const tw = line.tw_Id;
    const pack = engine.packagingLookup.get(tw) ?? null;
    const unitPrice = unitPricePerPiece(prices.get(tw)?.priceNet ?? null, pack);
    const minStock = engine.minStockByTwId.get(tw) ?? null;
    const openZdQty = zdDocumentUnitsToPieces(
      Math.max(0, num(line.otwarteZd)),
      pack?.unitsPerPackage,
      pack?.documentUnitMode ?? "packages"
    );
    const signal = analyzeStockWatchItem({
      availableQty: num(line.dostepne),
      openZdQty,
      velocityDaily: num(line.sprzedazDziennie),
      targetQty: num(line.celZapasuTracked),
      minStockQty: minStock,
      unitPriceNet: unitPrice,
      salesEndDate: run.salesEndDate,
    });
    const order = orderByTw.get(tw) ?? null;
    const lineValue =
      order && order.zdUnits > 0 && unitPrice != null
        ? round(order.piecesArriving * unitPrice, 2)
        : null;
    if (order && order.zdUnits > 0) {
      zdUnitsSum += order.zdUnits;
      if (lineValue != null) orderValue += lineValue;
      else unpricedCount += 1;
    }
    return {
      subiektTwId: tw,
      supplierId: supplier.id,
      runId: run.id,
      twSymbol: line.tw_Symbol || null,
      twNazwa: String(line.tw_Nazwa ?? "").trim(),
      grtNazwa: line.grt_Nazwa || null,
      scopeMode: scope.mode,
      scopeId,
      stockQty: num(line.tw_Stan),
      reservedQty: num(line.tw_StanRez),
      availableQty: num(line.dostepne),
      openZdQty: round(openZdQty, 3),
      openZkUnreservedQty: num(line.otwarteZkBezRez),
      salesPeriodQty: num(line.sprzedazOkres),
      salesPeriodDays: dniZapasu,
      velocityDaily: round(Math.max(0, num(line.sprzedazDziennie)), 4),
      velocityTrend: null,
      daysOfCover: signal.daysOfCover,
      runOutDate: signal.runOutDate,
      bufferDays: dniZapasu,
      targetQty: round(num(line.celZapasuTracked), 2),
      minStockQty: minStock,
      inOrder: order != null,
      orderZdUnits: order?.zdUnits ?? 0,
      orderUnitLabel: order
        ? order.packagesMode
          ? order.packageLabel || "op."
          : "szt."
        : null,
      orderPieces: order?.piecesArriving ?? 0,
      orderIndividualPieces: order?.individualExtraPieces ?? 0,
      orderValue: lineValue,
      unitPriceNet: unitPrice,
      dailyValue: signal.dailyValue,
      status: signal.status,
    };
  });

  const itemsWritten = await replaceSupplierStockWatchItems(supplier.id, run.id, rows);
  await upsertStockWatchSupplierOrder({
    supplierId: supplier.id,
    runId: run.id,
    scopeMode: scope.mode,
    scopeId,
    dniZapasu,
    dataOd: window.dataOd,
    dataDo: window.dataDo,
    lineCount: list.lines.length,
    zdUnitsSum,
    orderValue: round(orderValue, 2),
    unpricedCount,
    explodeBomIncomplete: list.explodeBomIncomplete,
    historyFetchFailed: engine.historyFetchFailed,
    pendingIndividualsError: engine.pendingIndividualsError,
    truncated: engine.fetch.truncated,
  });

  return {
    itemsWritten,
    message: engine.fetch.truncated
      ? "Lista z Subiekta niepełna (limit stron) — część towarów pominięta."
      : null,
  };
}
