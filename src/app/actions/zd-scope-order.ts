"use server";

import { after } from "next/server";
import { requireZdEstimateAdmin } from "@/lib/auth";
import { listZdEstimateSupplierScopes } from "@/lib/data/zd-estimate-supplier-scopes";
import {
  findZdSharedScopes,
  loadZdScopeInsights,
  loadZdSharedScopeProducts,
  loadZdProductAssignments,
  loadZdSharedScopeStats,
  loadZdTwScopeFacts,
  setZdProductAssignments,
  type ZdScopeInsightsBundle,
  type ZdSharedScope,
  type ZdSharedScopeProduct,
  type ZdSharedScopeStats,
} from "@/lib/data/zd-scope-order";
import { syncSubiektScopeIndex } from "@/lib/orders/zd-scope-index";
import type { ZdEstimateRunMode } from "@/lib/orders/zd-estimate-scope";
import { resolveSubiektOrdersConfig } from "@/lib/subiekt/config";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";

type Result<T> = ({ ok: true } & T) | { ok: false; message: string };

/** Przebudowa indeksu w tle (ok. 2 min) — jedna naraz na proces. */
let indexSyncRunning = false;

/** Pokrycie i podpowiedzi zakresów dla wszystkich dostawców + wspólne zakresy. */
export async function actionLoadZdScopeOrder(): Promise<
  Result<
    ZdScopeInsightsBundle & {
      sharedScopes: ZdSharedScope[];
      sharedScopeStats: ZdSharedScopeStats[];
      indexSyncRunning: boolean;
    }
  >
> {
  await requireZdEstimateAdmin("read");
  try {
    const scopes = await listZdEstimateSupplierScopes();
    const sharedScopes = findZdSharedScopes(scopes);
    const [bundle, sharedScopeStats] = await Promise.all([
      loadZdScopeInsights(scopes),
      // Postęp rozdzielania jest dodatkiem — błąd nie blokuje podpowiedzi.
      loadZdSharedScopeStats(sharedScopes).catch((e) => {
        console.error("[zd-scope-order] shared scope stats", e);
        return [];
      }),
    ]);
    return {
      ok: true,
      ...bundle,
      sharedScopes,
      sharedScopeStats,
      indexSyncRunning,
    };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się wczytać podpowiedzi zakresów.") };
  }
}

export async function actionStartZdScopeIndexSync(): Promise<Result<object>> {
  await requireZdEstimateAdmin("mutate");
  const orders = resolveSubiektOrdersConfig();
  if (!orders.ok) return { ok: false, message: orders.message };
  if (indexSyncRunning) return { ok: false, message: "Indeks już się buduje - poczekaj chwilę." };
  indexSyncRunning = true;
  after(async () => {
    try {
      const res = await syncSubiektScopeIndex({ deadlineMs: Date.now() + 10 * 60_000 });
      if (!res.ok) console.error("[zd-scope-index] sync", res.error);
    } finally {
      indexSyncRunning = false;
    }
  });
  return { ok: true };
}

/** Towary wspólnego zakresu z podpowiedzią dostawcy z historii ZD. */
export async function actionLoadZdSharedScopeProducts(input: {
  mode: ZdEstimateRunMode;
  scopeId: number;
  /** Także towary zakresu bez historii ZD (do limitu). */
  includeAll?: boolean;
}): Promise<
  Result<{ scope: ZdSharedScope; products: ZdSharedScopeProduct[]; truncated: boolean }>
> {
  await requireZdEstimateAdmin("read");
  try {
    // Dostawców wspólnego zakresu bierzemy z bazy, nie od klienta.
    const scope = findZdSharedScopes(await listZdEstimateSupplierScopes()).find(
      (s) => s.mode === input.mode && s.scopeId === Math.trunc(Number(input.scopeId))
    );
    if (!scope) return { ok: false, message: "Ten zakres nie jest już wspólny dla kilku dostawców." };
    const { products, truncated } = await loadZdSharedScopeProducts({
      mode: scope.mode,
      scopeId: scope.scopeId,
      supplierIds: scope.supplierIds,
      includeAll: input.includeAll === true,
    });
    return { ok: true, scope, products, truncated };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się wczytać towarów zakresu.") };
  }
}

/** Limit jednego zapisu — powyżej limitu listy w panelu (3000), żeby „wszystkie” mieściły się w jednym zapisie. */
const MAX_ASSIGNMENTS_PER_SAVE = 5000;

/**
 * Przypisanie towarów wspólnego zakresu do dostawców (null = zdejmij przypisanie).
 * Serwer sprawdza, że towar leży we wspólnym zakresie, a dostawca ten zakres dzieli;
 * symbol i nazwę bierze z katalogu, nie od klienta.
 */
export async function actionSetZdProductAssignments(input: {
  items: { subiektTwId: number; supplierId: string | null }[];
}): Promise<Result<object>> {
  const user = await requireZdEstimateAdmin("mutate");
  const raw = Array.isArray(input.items) ? input.items : [];
  if (raw.length > MAX_ASSIGNMENTS_PER_SAVE) {
    return { ok: false, message: `Za dużo towarów naraz (max ${MAX_ASSIGNMENTS_PER_SAVE}).` };
  }
  const items = raw
    .map((i) => ({
      subiektTwId: Math.trunc(Number(i.subiektTwId)),
      supplierId: typeof i.supplierId === "string" && i.supplierId.trim() ? i.supplierId.trim() : null,
    }))
    .filter((i) => Number.isSafeInteger(i.subiektTwId) && i.subiektTwId > 0 && i.subiektTwId <= 2_147_483_647);
  if (!items.length) return { ok: false, message: "Brak towarów do zapisania." };
  try {
    const twIds = items.map((i) => i.subiektTwId);
    const unassignIds = items.filter((i) => !i.supplierId).map((i) => i.subiektTwId);
    const [shared, facts, existing] = await Promise.all([
      listZdEstimateSupplierScopes().then(findZdSharedScopes),
      loadZdTwScopeFacts(twIds),
      // Zapisane przypisania potrzebne tylko do zdejmowania (towar ze zniesionego zakresu).
      unassignIds.length ? loadZdProductAssignments(unassignIds) : Promise.resolve(new Map()),
    ]);
    const rows = [];
    for (const item of items) {
      const f = facts.get(item.subiektTwId);
      const label = f?.symbol ?? `#${item.subiektTwId}`;
      const owners = new Set(
        shared
          .filter((sh) =>
            f && (sh.mode === "cecha" ? f.cechaIds.includes(sh.scopeId) : f.grupaId === sh.scopeId)
          )
          .flatMap((sh) => sh.supplierIds)
      );
      if (!item.supplierId) {
        // Zdjęcie przypisania tylko przywraca widoczność u wszystkich — dozwolone także dla
        // towaru, którego zakres przestał być wspólny (inaczej zostałby osierocony).
        if (!f || (owners.size === 0 && !existing.has(item.subiektTwId))) {
          return { ok: false, message: `Towar ${label} nie należy do wspólnego zakresu - odśwież listę.` };
        }
      } else if (!f || owners.size === 0) {
        return { ok: false, message: `Towar ${label} nie należy już do wspólnego zakresu - odśwież listę.` };
      } else if (!owners.has(item.supplierId)) {
        return { ok: false, message: `Towar ${label}: wybrany dostawca nie ma tego zakresu - odśwież listę.` };
      }
      rows.push({ ...item, twSymbol: f?.symbol ?? null, twNazwa: f?.name ?? "" });
    }
    await setZdProductAssignments(rows, user.id);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się zapisać przypisań.") };
  }
}
