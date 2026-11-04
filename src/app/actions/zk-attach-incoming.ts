"use server";

// @service-role-ok — autoryzacja getSessionUser() + canSalesUserActOnZkWatch(); service role po warstwie aplikacji.

import { revalidatePath } from "next/cache";
import { getSessionUser, type SessionUser } from "@/lib/auth";
import { releaseLock, tryAcquireLock } from "@/lib/services/locks";
import { assertPasswordChangeCompleted } from "@/lib/auth/must-change-password-guard";
import { isSalesAccount } from "@/lib/auth-roles";
import { createAdminClient } from "@/lib/db/admin";
import { fetchTeethProductInfo } from "@/lib/data/teeth-products";
import { fetchProsbaLineStock } from "@/lib/orders/fetch-prosba-line-stock";
import { loadProsbaAlreadyOrdered } from "@/lib/orders/prosba-already-ordered-load";
import { adjustStockMapForZkLines } from "@/lib/orders/prosba-stock-check";
import { assertCanSubmitIndividualOrders } from "@/lib/auth/assert-order-submit-access";
import { selectZkLinesToAttachIncoming } from "@/lib/sales/zk-attach-incoming";
import { buildServerAutoProsbaEntries } from "@/lib/sales/zk-watch-auto-prosba";
import { assertZkWatchOpenForProsba } from "@/lib/sales/zk-watch-closed-for-prosba";
import { fetchAllZkLinkableOrdersForSalesPerson } from "@/lib/sales/zk-watch-close-pending-fetch";
import { buildZkWatchLineViews } from "@/lib/sales/zk-watch-lines";
import { computeZkWatchOrderHints } from "@/lib/sales/zk-watch-order-link";
import { canSalesUserActOnZkWatch } from "@/lib/sales/zk-watch-sales-access";
import { buildTeethDraftRegistryFromProductInfo } from "@/lib/sales/zk-watch-teeth-draft-registry";
import { batchAddIndividualOrders, type InTransitCover } from "@/lib/services/orders";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import type { AddIndividualOrdersEntry } from "@/lib/orders/individual-request-edit";
import type { SalesZkWatch } from "@/types/database";

export type ZkAttachIncomingResult =
  | {
      ok: true;
      attached: number;
      requested: number;
      /** Klucze pozycji ZK, które dostały prośbę „już zamówione” (reszta została bez zmian). */
      attachedKeys: string[];
      dokNrs: string[];
    }
  | { ok: false; error: string };

/** Więcej pozycji niż ma realne ZK — reszta to śmieci od klienta. */
const MAX_REQUESTED_KEYS = 200;

/**
 * Notatnik ZK: pozycje, których handlowiec nie zamawia, bo pokryje je towar w drodze,
 * stają się od razu prośbami „już zamówione”, podpiętymi pod ZD z terminem — jak po
 * „Już zamówione” zakupów, bez kolejki. Klient wskazuje tylko klucze pozycji; pokrycie,
 * ZD i dostawcę serwer liczy sam z Subiekta na żywo, a pozycję bez pewności pomija.
 */
export async function actionAttachZkLinesToIncoming(
  watchId: string,
  lineKeys: string[],
  options?: { delegateFor?: string }
): Promise<ZkAttachIncomingResult> {
  try {
    const user = await getSessionUser();
    if (!user || !isSalesAccount(user.role)) return { ok: false, error: "Brak uprawnień." };
    assertPasswordChangeCompleted(user);

    const requestedKeys = [...new Set((Array.isArray(lineKeys) ? lineKeys : []).map((k) => String(k).trim()).filter(Boolean))].slice(
      0,
      MAX_REQUESTED_KEYS
    );
    const none = { ok: true as const, attached: 0, requested: requestedKeys.length, attachedKeys: [], dokNrs: [] };
    if (requestedKeys.length === 0) return none;

    const supabase = createAdminClient();
    const { data: row, error } = await supabase
      .from("sales_zk_watches")
      .select("*")
      .eq("id", String(watchId).trim())
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { ok: false, error: "ZK niedostępne - odśwież notatnik." };
    const watch = row as SalesZkWatch;
    if (!(await canSalesUserActOnZkWatch(user, watch, options?.delegateFor))) {
      return { ok: false, error: "Brak uprawnień do tego ZK." };
    }
    assertZkWatchOpenForProsba(watch);

    // Dwa zapisy tego samego ZK naraz (dwie karty, podwójne kliknięcie) widziałyby pozycję jako
    // niepokrytą i utworzyły dwie prośby — sprawdzenie i zapis idą pod jednym zamkiem na ZK.
    const lockKey = `ZK_ATTACH_INCOMING:${watch.id}`;
    if (!(await tryAcquireLock(lockKey, 60, user.id))) {
      return { ok: false, error: "Trwa zapis tego ZK - spróbuj ponownie za chwilę." };
    }
    try {
      return await attachUnderLock(user, watch, requestedKeys, none);
    } finally {
      await releaseLock(lockKey);
    }
  } catch (e) {
    return { ok: false, error: userFacingErrorText(e, "Nie udało się podpiąć pozycji pod dostawę.") };
  }
}

async function attachUnderLock(
  user: SessionUser,
  watch: SalesZkWatch,
  requestedKeys: string[],
  none: Extract<ZkAttachIncomingResult, { ok: true }>
): Promise<ZkAttachIncomingResult> {
  const supabase = createAdminClient();

  // Bez katalogu zębów nie odróżnimy pozycji zębów (osobny proces) — nic nie podpinamy.
  const teethInfo = await fetchTeethProductInfo().catch(() => null);
  if (!teethInfo) return none;
  const teethRegistry = { ...buildTeethDraftRegistryFromProductInfo(teethInfo), catalogAvailable: true };

  // Pozycje z jakąkolwiek prośbą (otwartą lub zrealizowaną) już są pokryte. Pokrycie liczymy
  // wprost: pozycja podpinana jest poza zakresem prośby, więc nie ma jej w uncoveredLineKeys.
  const linkable = await fetchAllZkLinkableOrdersForSalesPerson(supabase, watch.sales_person_id);
  const coverage = computeZkWatchOrderHints(watch, linkable).lineCoverageByKey;
  const productLines = buildZkWatchLineViews(watch).filter((l) => l.key !== "summary");
  const wanted = new Set(requestedKeys.filter((k) => coverage[k] === "uncovered"));
  const lines = productLines.filter((l) => wanted.has(l.key));
  const twIds = [...new Set(lines.map((l) => l.subiektTwId).filter((id): id is number => id != null))];
  if (twIds.length === 0) return none;

  const [rawStock, incomingByTwId] = await Promise.all([
    fetchProsbaLineStock(twIds),
    loadProsbaAlreadyOrdered(twIds, watch.sales_person_id),
  ]);
  const stockByTwId = adjustStockMapForZkLines(productLines, rawStock);
  const candidates = selectZkLinesToAttachIncoming({
    lines,
    stockByTwId,
    incomingByTwId,
    stockExemptTwIds: teethRegistry.twIds,
    requireSupplier: true,
  });

  const entries: AddIndividualOrdersEntry[] = [];
  const covers = new Map<number, InTransitCover>();
  const attachedKeys: string[] = [];
  for (const c of candidates) {
    const built = buildServerAutoProsbaEntries({ watch, lineKeys: [c.key], teethRegistry, stockByTwId });
    if (built.length !== 1 || !c.doc.supplierId || !c.doc.deadline) continue;
    covers.set(entries.length, {
      supplierId: c.doc.supplierId,
      dokNr: c.doc.dokNr,
      dokId: c.doc.dokId ?? null,
      deadline: c.doc.deadline,
    });
    entries.push({ ...built[0]!, supplierId: c.doc.supplierId });
    attachedKeys.push(c.key);
  }
  if (entries.length === 0) return none;

  await assertCanSubmitIndividualOrders(user, entries);
  const result = await batchAddIndividualOrders(entries, user.id === "dev" ? undefined : user.id, {
    submitMode: "sales",
    inTransitCovers: covers,
  });

  // Termin i numer ZD już są; sync potwierdzi dopasowanie i będzie pilnował zmian.
  const { scheduleZdEtaSyncAfterProcurement } = await import("@/lib/subiekt/zd-eta-procurement-trigger");
  await scheduleZdEtaSyncAfterProcurement([watch.sales_person_id]);
  for (const path of ["/moje", "/notatnik", "/zk", "/podsumowanie"]) revalidatePath(path);

  return {
    ok: true,
    attached: result.attached,
    requested: requestedKeys.length,
    // Wstawienie jest całe albo wcale — przy sukcesie podpięte są wszystkie zebrane pozycje.
    attachedKeys,
    dokNrs: [...new Set([...covers.values()].map((c) => c.dokNr))],
  };
}
