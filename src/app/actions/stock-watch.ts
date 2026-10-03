"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireZdEstimateAdmin } from "@/lib/auth";
import { userFacingErrorTextFromMessage } from "@/lib/ui/user-facing-error";
import { getLatestStockWatchRun, searchStockWatchItems } from "@/lib/stock-watch/data";
import { toStockWatchRowView, type StockWatchRowView } from "@/lib/stock-watch/dashboard";
import { runStockWatchWorker } from "@/lib/stock-watch/worker";
import type { StockWatchRule } from "@/lib/stock-watch/analysis";
import {
  actionClearZdEstimateOnRequest,
  actionExcludeZdEstimateProduct,
  actionMarkZdEstimateOnRequest,
  actionRestoreZdEstimateProduct,
} from "@/app/actions/zd-estimate";

export type StockWatchActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; message: string };

const PANEL_PATH = "/zakupy/braki";

function fail(e: unknown, fallback: string): { ok: false; message: string } {
  const raw = e instanceof Error ? e.message : String(e);
  return { ok: false, message: userFacingErrorTextFromMessage(raw) || fallback };
}

/** „Przelicz teraz” — worker w tle po odpowiedzi (panel odświeża status). */
export async function actionStartStockWatchRun(): Promise<
  StockWatchActionResult<{ startedAt: string }>
> {
  await requireZdEstimateAdmin("mutate");
  const latest = await getLatestStockWatchRun();
  const heartbeatAge = latest ? Date.now() - Date.parse(latest.heartbeatAt) : Infinity;
  if (latest?.status === "running" && heartbeatAge < 5 * 60 * 1000) {
    return { ok: false, message: "Analiza już trwa - poczekaj na jej koniec." };
  }
  after(async () => {
    try {
      await runStockWatchWorker({ trigger: "manual", force: true, budgetMs: 13 * 60 * 1000 });
    } catch (e) {
      console.error("[stock-watch] manual run", e);
    }
  });
  return { ok: true, data: { startedAt: new Date().toISOString() } };
}

/**
 * Reguła towaru przez akcje kreatora ZD (te same tabele i semantyka):
 * Standard = bez wpisów; Na prośbę = bez wykluczenia + wpis prośby; Wyklucz = wykluczenie
 * (kreator sam czyści „na prośbę”).
 */
export async function actionSetStockWatchRule(input: {
  subiektTwId: number;
  twSymbol: string | null;
  twNazwa: string;
  rule: StockWatchRule;
  note?: string;
}): Promise<StockWatchActionResult> {
  await requireZdEstimateAdmin("mutate");
  const product = {
    subiektTwId: input.subiektTwId,
    twSymbol: input.twSymbol,
    twNazwa: input.twNazwa,
    note: input.note?.trim() || undefined,
  };
  const steps =
    input.rule === "excluded"
      ? [() => actionExcludeZdEstimateProduct(product)]
      : input.rule === "on_request"
        ? [
            () => actionRestoreZdEstimateProduct(input.subiektTwId),
            () => actionMarkZdEstimateOnRequest(product),
          ]
        : [
            () => actionRestoreZdEstimateProduct(input.subiektTwId),
            () => actionClearZdEstimateOnRequest(input.subiektTwId),
          ];
  for (const step of steps) {
    const res = await step();
    if (!res.ok) return { ok: false, message: res.message };
  }
  revalidatePath(PANEL_PATH);
  return { ok: true };
}

export async function actionSearchStockWatchItems(
  term: string
): Promise<StockWatchActionResult<StockWatchRowView[]>> {
  await requireZdEstimateAdmin("read");
  try {
    const rows = await searchStockWatchItems(term);
    return { ok: true, data: rows.map(toStockWatchRowView) };
  } catch (e) {
    return fail(e, "Nie udało się wyszukać towarów.");
  }
}
