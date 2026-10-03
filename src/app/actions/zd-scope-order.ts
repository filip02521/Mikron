"use server";

import { after } from "next/server";
import { requireZdEstimateAdmin } from "@/lib/auth";
import { listZdEstimateSupplierScopes } from "@/lib/data/zd-estimate-supplier-scopes";
import {
  findZdSharedScopes,
  loadZdScopeInsights,
  loadZdSharedScopeProducts,
  setZdProductAssignments,
  type ZdScopeInsightsBundle,
  type ZdSharedScope,
  type ZdSharedScopeProduct,
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
  Result<ZdScopeInsightsBundle & { sharedScopes: ZdSharedScope[]; indexSyncRunning: boolean }>
> {
  await requireZdEstimateAdmin("read");
  try {
    const scopes = await listZdEstimateSupplierScopes();
    const bundle = await loadZdScopeInsights(scopes);
    return {
      ok: true,
      ...bundle,
      sharedScopes: findZdSharedScopes(scopes),
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
}): Promise<Result<{ scope: ZdSharedScope; products: ZdSharedScopeProduct[] }>> {
  await requireZdEstimateAdmin("read");
  try {
    // Dostawców wspólnego zakresu bierzemy z bazy, nie od klienta.
    const scope = findZdSharedScopes(await listZdEstimateSupplierScopes()).find(
      (s) => s.mode === input.mode && s.scopeId === Math.trunc(Number(input.scopeId))
    );
    if (!scope) return { ok: false, message: "Ten zakres nie jest już wspólny dla kilku dostawców." };
    const products = await loadZdSharedScopeProducts({
      mode: scope.mode,
      scopeId: scope.scopeId,
      supplierIds: scope.supplierIds,
    });
    return { ok: true, scope, products };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się wczytać towarów zakresu.") };
  }
}

/** Przypisanie towarów wspólnego zakresu do dostawców (null = zdejmij przypisanie). */
export async function actionSetZdProductAssignments(input: {
  items: { subiektTwId: number; supplierId: string | null; twSymbol: string | null; twNazwa: string }[];
}): Promise<Result<object>> {
  const user = await requireZdEstimateAdmin("mutate");
  const items = (Array.isArray(input.items) ? input.items : [])
    .map((i) => ({
      subiektTwId: Math.trunc(Number(i.subiektTwId)),
      supplierId: typeof i.supplierId === "string" && i.supplierId.trim() ? i.supplierId.trim() : null,
      twSymbol: i.twSymbol ?? null,
      twNazwa: String(i.twNazwa ?? ""),
    }))
    .filter((i) => i.subiektTwId > 0);
  if (!items.length) return { ok: false, message: "Brak towarów do zapisania." };
  if (items.length > 2000) return { ok: false, message: "Za dużo towarów naraz (max 2000)." };
  try {
    await setZdProductAssignments(items, user.id);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się zapisać przypisań.") };
  }
}
