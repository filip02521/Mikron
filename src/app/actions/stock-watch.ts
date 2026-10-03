"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireZdEstimateAdmin } from "@/lib/auth";
import { query } from "@/lib/db/pool";
import { fetchZdEstimatePackaging } from "@/lib/data/zd-estimate-packaging";
import {
  buildZdCreateApiBody,
  resolveZdCreateKhId,
} from "@/lib/orders/zd-estimate-create-zd";
import { computeZdPackOrderQty } from "@/lib/orders/zd-estimate-packaging";
import { createSubiektOrdersZd } from "@/lib/subiekt/api";
import { SubiektTimeoutError } from "@/lib/subiekt/errors";
import { resolveSubiektOrdersConfig } from "@/lib/subiekt/config";
import { formatZdCreateSferaUserMessage } from "@/lib/subiekt/sfera-create-error";
import { warsawNowParts } from "@/lib/time/warsaw";
import { userFacingErrorTextFromMessage } from "@/lib/ui/user-facing-error";
import {
  addPurchaseDraftLine,
  cancelPurchaseDraft,
  getPurchaseDraft,
  markPurchaseDraftSubmitted,
  openOrCreatePurchaseDraft,
  removePurchaseDraftLine,
  setPurchaseDraftLineQty,
  setPurchaseDraftNote,
} from "@/lib/stock-watch/drafts";
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
    return { ok: false, message: "Analiza już trwa — poczekaj na jej koniec." };
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

export async function actionOpenPurchaseDraft(
  supplierId: string
): Promise<StockWatchActionResult<{ draftId: string; created: boolean; lineCount: number }>> {
  const user = await requireZdEstimateAdmin("mutate");
  try {
    const res = await openOrCreatePurchaseDraft({ supplierId, createdBy: user.id });
    revalidatePath(PANEL_PATH);
    return {
      ok: true,
      data: { draftId: res.id, created: res.created, lineCount: res.lineCount },
    };
  } catch (e) {
    return fail(e, "Nie udało się przygotować szkicu zamówienia.");
  }
}

export async function actionSetDraftLineQty(input: {
  draftId: string;
  subiektTwId: number;
  qty: number;
}): Promise<StockWatchActionResult> {
  await requireZdEstimateAdmin("mutate");
  try {
    await setPurchaseDraftLineQty(input);
    return { ok: true };
  } catch (e) {
    return fail(e, "Nie zapisano ilości.");
  }
}

export async function actionRemoveDraftLine(input: {
  draftId: string;
  subiektTwId: number;
}): Promise<StockWatchActionResult> {
  await requireZdEstimateAdmin("mutate");
  try {
    await removePurchaseDraftLine(input);
    revalidatePath(`${PANEL_PATH}/szkic/${input.draftId}`);
    return { ok: true };
  } catch (e) {
    return fail(e, "Nie usunięto pozycji.");
  }
}

export async function actionAddDraftLine(input: {
  draftId: string;
  subiektTwId: number;
}): Promise<StockWatchActionResult> {
  await requireZdEstimateAdmin("mutate");
  try {
    await addPurchaseDraftLine(input);
    revalidatePath(`${PANEL_PATH}/szkic/${input.draftId}`);
    return { ok: true };
  } catch (e) {
    return fail(e, "Nie dodano pozycji.");
  }
}

export async function actionSetDraftNote(input: {
  draftId: string;
  note: string;
}): Promise<StockWatchActionResult> {
  await requireZdEstimateAdmin("mutate");
  try {
    await setPurchaseDraftNote(input);
    return { ok: true };
  } catch (e) {
    return fail(e, "Nie zapisano uwag.");
  }
}

export async function actionCancelDraft(draftId: string): Promise<StockWatchActionResult> {
  await requireZdEstimateAdmin("mutate");
  try {
    await cancelPurchaseDraft(draftId);
    revalidatePath(PANEL_PATH);
    return { ok: true };
  } catch (e) {
    return fail(e, "Nie anulowano szkicu.");
  }
}

/** Szkic w trakcie wysyłki do Subiekta (ten proces) — blokuje podwójne kliknięcie. */
const submittingDrafts = new Set<string>();

/**
 * Tworzy ZD w Subiekcie (Sfera, host ORDERS) ze szkicu.
 * Ilości ze szkicu (sztuki) → jednostki dokumentu wg opakowań z kreatora ZD.
 */
export async function actionSubmitDraftAsZd(input: {
  draftId: string;
  uwagi?: string;
}): Promise<StockWatchActionResult<{ dokId: number; dokNr: string | null }>> {
  const user = await requireZdEstimateAdmin("mutate");
  if (submittingDrafts.has(input.draftId)) {
    return { ok: false, message: "To zamówienie jest właśnie tworzone w Subiekcie." };
  }
  submittingDrafts.add(input.draftId);
  try {
    const orders = resolveSubiektOrdersConfig();
    if (!orders.ok) return { ok: false, message: orders.message };

    const draft = await getPurchaseDraft(input.draftId);
    if (!draft) return { ok: false, message: "Szkic nie istnieje." };
    if (draft.status !== "draft") {
      return {
        ok: false,
        message: draft.zdDokNr
          ? `Szkic już zamknięty — utworzono ${draft.zdDokNr}.`
          : "Szkic jest zamknięty.",
      };
    }
    if (!draft.lines.length) return { ok: false, message: "Szkic nie ma pozycji." };

    const supplier = await query<{ name: string; subiekt_kh_id: number | null }>(
      `SELECT name, subiekt_kh_id FROM suppliers WHERE id = $1`,
      [draft.supplierId]
    );
    const aliases = await query<{ subiekt_kh_id: number }>(
      `SELECT subiekt_kh_id FROM supplier_subiekt_kh_aliases WHERE supplier_id = $1`,
      [draft.supplierId]
    );
    const kh = resolveZdCreateKhId({
      supplierName: supplier.rows[0]?.name ?? draft.supplierName,
      primaryKhId: supplier.rows[0]?.subiekt_kh_id ?? null,
      additionalKhIds: aliases.rows.map((r) => Number(r.subiekt_kh_id)),
    });
    if (!kh.ok) return { ok: false, message: kh.message };

    const packaging = new Map(
      (await fetchZdEstimatePackaging()).map((p) => [p.subiektTwId, p])
    );
    const lines = draft.lines
      .map((line) => {
        const pack = packaging.get(line.subiektTwId);
        const qty = computeZdPackOrderQty(
          line.qty,
          pack?.unitsPerPackage ?? 1,
          pack?.packageLabel ?? "op.",
          pack?.documentUnitMode ?? "packages",
          pack?.orderMultiple ?? null
        );
        return { twId: line.subiektTwId, ilosc: qty.zdUnits, symbol: line.twSymbol };
      })
      .filter((l) => l.ilosc > 0);
    if (!lines.length) return { ok: false, message: "Brak pozycji z ilością do zamówienia." };

    const uwagi =
      input.uwagi?.trim() ||
      draft.note.trim() ||
      `Braki i zamówienia — ${warsawNowParts().dateKey}`;
    const created = await createSubiektOrdersZd(
      buildZdCreateApiBody({ kontrahentId: kh.khId, uwagi, lines })
    );
    const dokId = Math.trunc(Number(created.dok_Id));
    const dokNr = created.dok_NrPelny ?? null;
    await markPurchaseDraftSubmitted({
      draftId: draft.id,
      zdDokId: dokId,
      zdDokNr: dokNr,
      submittedBy: user.id,
    });
    console.info("[stock-watch:zd-create:ok]", {
      draftId: draft.id,
      supplierId: draft.supplierId,
      dokId,
      dokNr,
      lines: lines.length,
      userId: user.id,
    });
    revalidatePath(PANEL_PATH);
    revalidatePath(`${PANEL_PATH}/szkic/${draft.id}`);
    return { ok: true, data: { dokId, dokNr } };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    console.warn("[stock-watch:zd-create:fail]", { draftId: input.draftId, message: raw });
    if (e instanceof SubiektTimeoutError) {
      // Sfera mogła zapisać dokument mimo braku odpowiedzi — ponowienie grozi duplikatem.
      return {
        ok: false,
        message:
          "Subiekt nie odpowiedział w czasie — ZD mogło powstać. Sprawdź listę ZD dostawcy w Subiekcie, zanim spróbujesz ponownie.",
      };
    }
    const formatted = formatZdCreateSferaUserMessage(raw);
    return { ok: false, message: formatted.message || "Nie udało się utworzyć ZD." };
  } finally {
    submittingDrafts.delete(input.draftId);
  }
}
