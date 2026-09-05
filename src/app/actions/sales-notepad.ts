"use server";

// @service-role-ok — autoryzacja require*(); service role z pełnym scope po warstwie aplikacji.

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { isSalesAccount, isSalesManager } from "@/lib/auth-roles";
import { isProfileActiveDelegateForSalesPerson } from "@/lib/data/vacation-delegations";
import { canAccessSalesPerson } from "@/lib/data/sales-group-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSubiektZk } from "@/lib/subiekt/api";
import {
  mapZkDocument,
  resolveZkBySubiektDokId,
  searchZkForAdd,
  type ZkSearchCandidate,
} from "@/lib/subiekt/resolve-zk-document";
import { validateZkQueryForSubmit } from "@/lib/subiekt/zk-search";
import { extractZkSerial, zkNumbersEquivalent } from "@/lib/subiekt/zk-document";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import { UNDO_WINDOW_MS, undoExpiredServerMessage } from "@/lib/orders/daily-panel-undo";
import {
  resolveNoteCreateFields,
  resolveNoteUpdateContentFields,
} from "@/lib/sales/note-content";
import {
  buildZkWatchLineViews,
  mergeLineChecksAfterRefresh,
  parseZkWatchLineChecks,
  type ZkWatchLineCheckStored,
} from "@/lib/sales/zk-watch-lines";
import { mergeZkWatchLineChecksPreservingProsbaScope } from "@/lib/sales/zk-watch-prosba-scope";
import { computeZkWatchRefreshDiff } from "@/lib/sales/zk-watch-refresh-diff";
import {
  clearZkTeethDraftsForKeys,
  isZkTeethDraftComplete,
  mergeZkTeethDraftsAfterRefresh,
  parseZkTeethDrafts,
  teethDraftKeysExcludedFromScope,
  upsertZkTeethDraft,
  type ZkTeethLineDraft,
} from "@/lib/sales/zk-watch-teeth-draft";
import { buildTeethDraftRegistryFromProductInfo } from "@/lib/sales/zk-watch-teeth-draft-registry";
import { fetchTeethProductInfo } from "@/lib/data/teeth-products";
import {
  type ZkProsbaPrefill,
  zkProsbaPrefillFromWatch,
  extractProsbaLinesFromZkWatch,
} from "@/lib/orders/zk-watch-prosba-prefill";
import { teethLineDetailsComplete } from "@/lib/teeth/teeth-validation";
import {
  isTeethManufacturer,
  isTeethProductLine,
  manufacturerForProductLine,
  parseTeethKind,
  type TeethKind,
  type TeethLineDetail,
  type TeethManufacturer,
  type TeethProductLine,
} from "@/lib/teeth/teeth-catalog";
import {
  buildTeethRegistryIndex,
  resolveTeethCatalogProduct,
} from "@/lib/teeth/teeth-dual-kind";
import { fetchZkWatchForProsbaPrefill } from "@/lib/sales/fetch-zk-watch-for-prefill";
import { nullIfZkWatchClosedForProsba } from "@/lib/sales/zk-watch-closed-for-prosba";
import { enrichZkProsbaPrefillWithLiveStock } from "@/lib/orders/fetch-prosba-line-stock";
import { fetchAllZkLinkableOrdersForSalesPerson } from "@/lib/sales/zk-watch-close-pending-fetch";
import { computeZkWatchOrderHints } from "@/lib/sales/zk-watch-order-link";
import {
  assessZkWatchAutoProsbaEligibility,
  buildServerAutoProsbaEntries,
  resolveAutoProsbaLineKeys,
  resolveAutoProsbaResultCodeAfterSubmit,
  resolveClientAutoProsbaStockSnapshot,
} from "@/lib/sales/zk-watch-auto-prosba";
import {
  buildAutoProsbaSuccessToast,
  toastForAutoProsbaBlockedCode,
  type AutoProsbaToastPayload,
} from "@/lib/sales/zk-watch-auto-prosba-copy";
import { buildMojeClientLink } from "@/lib/sales/notepad-follow-up";
import { appendMojeFocusOrderIds } from "@/lib/orders/moje-order-focus";
import { fetchProsbaLineStock } from "@/lib/orders/fetch-prosba-line-stock";
import { collectProsbaLineTwIdsMissingStock } from "@/lib/orders/prosba-stock-check";
import { ProsbaSufficientStockError } from "@/lib/orders/prosba-stock-server";
import { assertCanSubmitIndividualOrders } from "@/lib/auth/assert-order-submit-access";
import { shouldIncludeZkCaseNoteInPrefill } from "@/lib/sales/zk-watch-case-note-prosba";
import { actionAddIndividualOrders } from "@/app/actions/admin";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import { polishPozycjeLabel } from "@/lib/email/polish-plural";
import {
  normalizeZkCaseNote,
  openZkLinkedOrdersWithCaseNoteState,
  resolveZkCaseNoteSyncOrderIds,
} from "@/lib/sales/zk-watch-case-note-prosba";
import { resolveZkProsbaPrefillSalesPersonAccess } from "@/lib/sales/zk-prosba-prefill-access";
import type { SalesNote, SalesNoteColor, SalesZkWatch } from "@/types/database";
import type { SupabaseClient } from "@/lib/db/admin";

async function salesPersonIdForAction(delegateFor?: string): Promise<string> {
  const user = await getSessionUser();
  if (!user) throw new Error("Wymagane logowanie");
  if (!isSalesAccount(user.role)) {
    throw new Error("Brak uprawnień do tej operacji.");
  }
  if (delegateFor && delegateFor.trim()) {
    const isDelegate = await isProfileActiveDelegateForSalesPerson(user.id, delegateFor);
    if (!isDelegate) {
      throw new Error("Brak uprawnień do tego panelu.");
    }
    return delegateFor;
  }
  const resolved = await resolveSalesPersonForUser(user);
  if (!resolved) {
    throw new Error("Konto nie jest powiązane z kartą handlowca.");
  }
  return resolved.id;
}

/** ID handlowca dla prefill prośby — z kontrolą dostępu (grupy kierownika). */
async function resolveSalesPersonIdForProsbaPrefill(
  user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>,
  salesPersonIdOverride?: string
): Promise<string> {
  const salesPersonId = salesPersonIdOverride?.trim() || "";
  if (!salesPersonId) {
    return salesPersonIdForAction();
  }
  const own = await resolveSalesPersonForUser(user);
  // canAccessSalesPerson = scope kierownika/admina — NIE obejmuje zwykłego sales
  // na własnej karcie. Wcześniej sales+lockedId zawsze wpadało w false → fałszywy 403.
  const canAccessRequested =
    own?.id === salesPersonId
      ? true
      : await canAccessSalesPerson(user, salesPersonId);
  const access = resolveZkProsbaPrefillSalesPersonAccess({
    role: user.role,
    ownSalesPersonId: own?.id ?? null,
    requestedSalesPersonId: salesPersonId,
    canAccessRequested,
  });
  if (!access.ok) {
    throw new Error(access.message);
  }
  return salesPersonId;
}

function revalidateNotepad() {
  revalidatePath("/notatnik");
  revalidatePath("/zk");
}

/** Odłóż rewalidację po odpowiedzi action — duże ZK nie timeoutują UI. */
function scheduleNotepadRevalidation() {
  after(() => {
    revalidateNotepad();
    revalidatePath("/", "layout");
  });
}

function isDuplicateKeyError(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

async function assertSubiektReachableForZk(): Promise<void> {
  if (!(await isSubiektReachable())) {
    throw new Error(
      "Brak połączenia z systemem magazynowym — nie można wczytać danych ZK. Poczekaj na przywrócenie połączenia i użyj „Sprawdź ponownie” u góry strony."
    );
  }
}

export type ZkAddWatchResult =
  | { kind: "added"; watch: SalesZkWatch }
  | { kind: "choose"; candidates: ZkSearchCandidate[]; hint: string }
  | { kind: "error"; message: string };

async function persistZkWatch(
  salesPersonId: string,
  resolved: Awaited<ReturnType<typeof mapZkDocument>>
): Promise<SalesZkWatch> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("sales_zk_watches")
    .select("id, closed_at, archived_at, note, line_checks")
    .eq("sales_person_id", salesPersonId)
    .eq("subiekt_dok_id", resolved.subiektDokId)
    .maybeSingle();

  if (existing && !existing.closed_at && !existing.archived_at) {
    throw new Error(`ZK ${resolved.zkNumber} jest już na liście oczekujących.`);
  }

  const reactivating = Boolean(existing?.closed_at || existing?.archived_at);
  const snapshot = resolved.snapshot as unknown as Record<string, unknown>;
  const mergedLineChecks =
    reactivating && existing
      ? mergeLineChecksAfterRefresh(
          parseZkWatchLineChecks(existing.line_checks),
          buildZkWatchLineViews({
            id: existing.id,
            sales_person_id: salesPersonId,
            subiekt_dok_id: resolved.subiektDokId,
            zk_number: resolved.zkNumber,
            client_label: resolved.clientLabel,
            client_kh_id: resolved.clientKhId,
            amount_net: resolved.amountNet,
            amount_gross: resolved.amountGross,
            zk_issued_at: resolved.issuedAt,
            note: null,
            line_summary: resolved.lineSummary,
            subiekt_snapshot: snapshot,
            line_checks: [],
            follow_up_at: null,
            closed_at: null,
            archived_at: null,
            created_at: now,
            updated_at: now,
          })
        )
      : undefined;

  const row = {
    sales_person_id: salesPersonId,
    subiekt_dok_id: resolved.subiektDokId,
    zk_number: resolved.zkNumber,
    client_label: resolved.clientLabel,
    client_kh_id: resolved.clientKhId,
    amount_net: resolved.amountNet,
    amount_gross: resolved.amountGross,
    zk_issued_at: resolved.issuedAt,
    line_summary: resolved.lineSummary,
    subiekt_snapshot: snapshot,
    closed_at: null,
    archived_at: null,
    follow_up_at: reactivating ? null : undefined,
    note: reactivating ? null : existing?.note ?? null,
    ...(mergedLineChecks != null ? { line_checks: mergedLineChecks } : {}),
    updated_at: now,
  };

  const rowForWrite = Object.fromEntries(
    Object.entries(row).filter(([, value]) => value !== undefined)
  );

  if (existing) {
    const { data, error } = await supabase
      .from("sales_zk_watches")
      .update(rowForWrite)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    scheduleNotepadRevalidation();
    return data as SalesZkWatch;
  }

  const { data, error } = await supabase
    .from("sales_zk_watches")
    .insert({ ...rowForWrite, created_at: now })
    .select("*")
    .single();

  if (error) {
    if (isDuplicateKeyError(error)) {
      throw new Error(`ZK ${resolved.zkNumber} jest już na liście oczekujących.`);
    }
    throw new Error(error.message);
  }

  scheduleNotepadRevalidation();
  return data as SalesZkWatch;
}

/**
 * Wpisz numer ZK — dodaje obserwację lub zwraca listę do wyboru.
 * Błędy biznesowe wracają jako `{ kind: "error" }` (bez throw), żeby produkcja
 * Next nie zamieniała komunikatu PL na generyczny „Server Components render”.
 */
export async function actionAddZkWatchByNumber(
  zkQuery: string
): Promise<ZkAddWatchResult> {
  try {
    await assertSubiektReachableForZk();
    const salesPersonId = await salesPersonIdForAction();
    const result = await searchZkForAdd(zkQuery);

    if (result.kind === "error") {
      return { kind: "error", message: result.message };
    }
    if (result.kind === "choose") {
      return {
        kind: "choose",
        candidates: result.candidates,
        hint: result.hint,
      };
    }

    const watch = await persistZkWatch(salesPersonId, result.resolved);
    return { kind: "added", watch };
  } catch (e) {
    return {
      kind: "error",
      message: userFacingErrorText(e, "Nie udało się dodać zamówienia."),
    };
  }
}

/** Dodaje ZK wybrane z listy kandydatów (po wyszukiwaniu). */
export async function actionAddZkWatchBySubiektDokId(
  subiektDokId: number
): Promise<ZkAddWatchResult> {
  try {
    await assertSubiektReachableForZk();
    const salesPersonId = await salesPersonIdForAction();
    const resolved = await resolveZkBySubiektDokId(subiektDokId);
    const watch = await persistZkWatch(salesPersonId, resolved);
    return { kind: "added", watch };
  } catch (e) {
    return {
      kind: "error",
      message: userFacingErrorText(e, "Nie udało się dodać zamówienia."),
    };
  }
}

/**
 * Odzyskanie po błędzie transportu server action — ZK mogło zostać zapisane w DB.
 * Dopasowanie po numerze (równoważne formaty, np. 3188/M/06/2026).
 */
export async function actionFindActiveZkWatchByQuery(
  zkQuery: string
): Promise<{ watch: SalesZkWatch }> {
  const salesPersonId = await salesPersonIdForAction();
  const validated = validateZkQueryForSubmit(zkQuery);
  if (!validated.ok) throw new Error(validated.message);

  const supabase = createAdminClient();
  const normalized = validated.normalized;
  const serial =
    extractZkSerial(normalized) ?? (/^\d+$/.test(normalized) ? normalized : null);

  let query = supabase
    .from("sales_zk_watches")
    .select("*")
    .eq("sales_person_id", salesPersonId)
    .is("closed_at", null)
    .is("archived_at", null);

  if (serial) {
    query = query.ilike("zk_number", `%${serial}%`);
  } else {
    const compact = normalized.replace(/\s+/g, "");
    if (compact) {
      query = query.ilike("zk_number", `%${compact}%`);
    }
  }

  const { data, error } = await query.order("updated_at", { ascending: false }).limit(24);

  if (error) throw new Error(error.message);

  const match = (data ?? []).find((row) =>
    zkNumbersEquivalent(String(row.zk_number ?? ""), validated.normalized)
  );
  if (!match) {
    throw new Error("Nie znaleziono aktywnego ZK na liście — odśwież stronę i sprawdź listę.");
  }

  return { watch: match as SalesZkWatch };
}

export async function actionCloseZkWatch(watchId: string, delegateFor?: string) {
  const salesPersonId = await salesPersonIdForAction(delegateFor);
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: row, error: fetchError } = await supabase
    .from("sales_zk_watches")
    .select("id, sales_person_id, closed_at")
    .eq("id", watchId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error("Nie znaleziono wpisu.");
  if (row.sales_person_id !== salesPersonId) {
    throw new Error("Brak uprawnień do tego wpisu.");
  }
  if (row.closed_at) throw new Error("Ten ZK został już zamknięty.");

  const { error } = await supabase
    .from("sales_zk_watches")
    .update({ closed_at: now, updated_at: now })
    .eq("id", watchId);

  if (error) throw new Error(error.message);
  scheduleNotepadRevalidation();
  return { success: true as const, closedAt: now };
}

export async function actionRestoreZkWatch(watchId: string) {
  const salesPersonId = await salesPersonIdForAction();
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: row, error: fetchError } = await supabase
    .from("sales_zk_watches")
    .select("id, sales_person_id, closed_at, archived_at")
    .eq("id", watchId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error("Nie znaleziono wpisu.");
  if (row.sales_person_id !== salesPersonId) {
    throw new Error("Brak uprawnień do tego wpisu.");
  }
  if (!row.closed_at && !row.archived_at) {
    throw new Error("Ten ZK jest już na liście oczekujących.");
  }

  const { data, error } = await supabase
    .from("sales_zk_watches")
    .update({
      closed_at: null,
      archived_at: null,
      follow_up_at: null,
      note: null,
      updated_at: now,
    })
    .eq("id", watchId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  scheduleNotepadRevalidation();
  return { watch: data as SalesZkWatch };
}

/** Cofnięcie zamknięcia ZK (toast undo) — w odróżnieniu od przywrócenia zachowuje notatkę i przypomnienie. */
export async function actionUndoCloseZkWatch(watchId: string, delegateFor?: string) {
  const salesPersonId = await salesPersonIdForAction(delegateFor);
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: row, error: fetchError } = await supabase
    .from("sales_zk_watches")
    .select("id, sales_person_id, closed_at")
    .eq("id", watchId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error("Nie znaleziono wpisu.");
  if (row.sales_person_id !== salesPersonId) {
    throw new Error("Brak uprawnień do tego wpisu.");
  }
  if (!row.closed_at) {
    throw new Error("Ten ZK jest już na liście oczekujących.");
  }
  const closedAt = new Date(row.closed_at).getTime();
  if (Date.now() - closedAt > UNDO_WINDOW_MS) {
    throw new Error(undoExpiredServerMessage("przy cofaniu zamknięcia sprawy ZK"));
  }

  const { data, error } = await supabase
    .from("sales_zk_watches")
    .update({ closed_at: null, archived_at: null, updated_at: now })
    .eq("id", watchId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  scheduleNotepadRevalidation();
  return { watch: data as SalesZkWatch };
}

export async function actionRefreshZkWatchFromSubiekt(watchId: string) {
  await assertSubiektReachableForZk();
  const salesPersonId = await salesPersonIdForAction();
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: row, error: fetchError } = await supabase
    .from("sales_zk_watches")
    .select("*")
    .eq("id", watchId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error("Nie znaleziono wpisu.");
  if (row.sales_person_id !== salesPersonId) {
    throw new Error("Brak uprawnień do tego wpisu.");
  }
  if (row.closed_at || row.archived_at) {
    throw new Error("Nie można odświeżyć zamkniętego ZK — przywróć go na listę.");
  }

  const doc = await getSubiektZk(row.subiekt_dok_id);
  const resolved = mapZkDocument(doc);

  const nextViews = buildZkWatchLineViews({
    ...(row as SalesZkWatch),
    subiekt_snapshot: resolved.snapshot as unknown as Record<string, unknown>,
    line_summary: resolved.lineSummary,
  });
  const mergedChecks = mergeLineChecksAfterRefresh(
    parseZkWatchLineChecks((row as SalesZkWatch).line_checks),
    nextViews
  );
  const refreshDiffPreview = computeZkWatchRefreshDiff(row as SalesZkWatch, {
    ...(row as SalesZkWatch),
    subiekt_snapshot: resolved.snapshot as unknown as Record<string, unknown>,
    line_summary: resolved.lineSummary,
  });
  const mergedTeethDrafts = mergeZkTeethDraftsAfterRefresh(
    (row as SalesZkWatch).teeth_drafts,
    nextViews,
    refreshDiffPreview
  );

  const expectedUpdatedAt = (row as SalesZkWatch).updated_at;
  const { data, error } = await supabase
    .from("sales_zk_watches")
    .update({
      zk_number: resolved.zkNumber,
      client_label: resolved.clientLabel,
      client_kh_id: resolved.clientKhId,
      amount_net: resolved.amountNet,
      amount_gross: resolved.amountGross,
      zk_issued_at: resolved.issuedAt,
      line_summary: resolved.lineSummary,
      subiekt_snapshot: resolved.snapshot as unknown as Record<string, unknown>,
      line_checks: mergedChecks,
      teeth_drafts: mergedTeethDrafts,
      updated_at: now,
    })
    .eq("id", watchId)
    .eq("updated_at", expectedUpdatedAt)
    .select("*")
    .maybeSingle();

  if (error) {
    if (error.message?.includes("teeth_drafts")) {
      throw new Error(
        "Brak kolumny teeth_drafts — uruchom migrację supabase/migrations/138_zk_watch_teeth_drafts.sql"
      );
    }
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error(
      "ZK został zaktualizowany w tle — odśwież listę i spróbuj ponownie."
    );
  }
  scheduleNotepadRevalidation();
  const refreshedWatch = data as SalesZkWatch;
  const refreshDiff = computeZkWatchRefreshDiff(row as SalesZkWatch, refreshedWatch);
  return { watch: refreshedWatch, refreshDiff };
}

function revalidateZkCaseNoteProsbaPaths() {
  scheduleNotepadRevalidation();
  revalidatePath("/moje");
  revalidatePath("/podsumowanie");
  revalidatePath("/zk");
  revalidatePath("/notatnik");
}

async function applyCaseNoteToOpenProsbaOrders(
  supabase: SupabaseClient,
  salesPersonId: string,
  orderIds: string[],
  caseNote: string | null
) {
  if (!orderIds.length) return;
  const { error } = await supabase
    .from("individual_orders")
    .update({
      sales_request_note: caseNote,
      // Notatka od handlowca — bez sygnału „uwagi od zakupów”.
      sales_request_note_updated_at: null,
      sales_request_note_seen_at: null,
      updated_at: new Date().toISOString(),
    })
    .in("id", orderIds)
    .eq("sales_person_id", salesPersonId);
  if (error) throw new Error(error.message);
}

export async function actionUpdateZkWatchNote(watchId: string, note: string) {
  const salesPersonId = await salesPersonIdForAction();
  const supabase = createAdminClient();
  const nextNote = normalizeZkCaseNote(note);

  const { data: row, error: fetchError } = await supabase
    .from("sales_zk_watches")
    .select("id, sales_person_id, closed_at, archived_at, note, include_note_in_prosba")
    .eq("id", watchId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error("Nie znaleziono wpisu.");
  if (row.sales_person_id !== salesPersonId) {
    throw new Error("Brak uprawnień do tego wpisu.");
  }
  if (row.closed_at || row.archived_at) {
    throw new Error("Nie można edytować notatki zamkniętego ZK.");
  }

  const previousNote = normalizeZkCaseNote(row.note as string | null);
  const includeNoteInProsba = Boolean(row.include_note_in_prosba) && Boolean(nextNote);

  const { data, error } = await supabase
    .from("sales_zk_watches")
    .update({
      note: nextNote,
      ...(nextNote ? {} : { include_note_in_prosba: false }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", watchId)
    .select("*")
    .single();

  if (error) {
    if (error.message?.includes("include_note_in_prosba")) {
      throw new Error(
        "Brak kolumny include_note_in_prosba — uruchom migrację supabase/migrations/137_zk_watch_include_note_in_prosba.sql"
      );
    }
    throw new Error(error.message);
  }

  let syncedOpenProsbaCount = 0;
  let pendingOpenProsbaCount = 0;
  let syncedOrderIds: string[] = [];
  let syncMessage: string | null = null;

  // Sync do otwartych próśb:
  // - flaga włączona → bezpieczna aktualizacja przy każdej zmianie treści
  // - kasowanie notatki → wyczyść w prośbach tylko treść ze sprawy ZK (nawet po wyłączeniu flagi)
  const shouldAttemptOpenProsbaSync =
    previousNote !== nextNote &&
    (Boolean(row.include_note_in_prosba) || (!nextNote && Boolean(previousNote)));

  if (shouldAttemptOpenProsbaSync) {
    const linked = await fetchAllZkLinkableOrdersForSalesPerson(supabase, salesPersonId);
    const watchForMatch = {
      ...(data as SalesZkWatch),
      note: nextNote,
      include_note_in_prosba: includeNoteInProsba,
    };
    const { openOrders, withoutNote } = openZkLinkedOrdersWithCaseNoteState(
      watchForMatch,
      linked
    );
    const syncIds = resolveZkCaseNoteSyncOrderIds({
      openOrders,
      previousCaseNote: previousNote,
      nextCaseNote: nextNote,
      mode: "safe_from_previous",
    });
    if (syncIds.length) {
      await applyCaseNoteToOpenProsbaOrders(supabase, salesPersonId, syncIds, nextNote);
      syncedOpenProsbaCount = syncIds.length;
      syncedOrderIds = syncIds;
    }
    const remaining = withoutNote.filter((o) => !syncIds.includes(o.id));
    pendingOpenProsbaCount = nextNote
      ? remaining.length
      : remaining.filter((o) => Boolean(normalizeZkCaseNote(o.sales_request_note))).length;
    if (syncedOpenProsbaCount > 0 && pendingOpenProsbaCount === 0) {
      syncMessage = nextNote
        ? `Zapisano. Zaktualizowano uwagi w prośbie (${polishPozycjeLabel(syncedOpenProsbaCount)}) — zakupy widzą nową treść.`
        : `Zapisano. Usunięto notatkę ze sprawy ZK z prośby (${polishPozycjeLabel(syncedOpenProsbaCount)}).`;
    } else if (syncedOpenProsbaCount > 0) {
      syncMessage = `Zapisano. Zaktualizowano ${polishPozycjeLabel(syncedOpenProsbaCount)}. Pozostały pozycje z inną notatką — możesz je nadpisać.`;
    } else if (pendingOpenProsbaCount > 0 && nextNote && Boolean(row.include_note_in_prosba)) {
      syncMessage =
        "Zapisano. W otwartej prośbie jest inna treść — użyj „Zaktualizuj w otwartej prośbie”, żeby zakupy widziały nową notatkę.";
    }
  }

  if (syncedOpenProsbaCount > 0) {
    revalidateZkCaseNoteProsbaPaths();
  } else {
    scheduleNotepadRevalidation();
  }

  return {
    success: true as const,
    watch: data as SalesZkWatch,
    syncedOpenProsbaCount,
    pendingOpenProsbaCount,
    syncedOrderIds,
    message: syncMessage,
  };
}

/** Włącz / wyłącz dołączanie notatki sprawy do prośby. */
export async function actionUpdateZkWatchIncludeNoteInProsba(
  watchId: string,
  include: boolean
) {
  const salesPersonId = await salesPersonIdForAction();
  const supabase = createAdminClient();

  const { data: row, error: fetchError } = await supabase
    .from("sales_zk_watches")
    .select("id, sales_person_id, closed_at, archived_at, note")
    .eq("id", watchId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error("Nie znaleziono wpisu.");
  if (row.sales_person_id !== salesPersonId) {
    throw new Error("Brak uprawnień do tego wpisu.");
  }
  if (row.closed_at || row.archived_at) {
    throw new Error("Nie można zmieniać ustawień zamkniętego ZK.");
  }
  const caseNote = normalizeZkCaseNote(row.note as string | null);
  if (include && !caseNote) {
    throw new Error("Najpierw zapisz notatkę do sprawy.");
  }

  const { data, error } = await supabase
    .from("sales_zk_watches")
    .update({
      include_note_in_prosba: include,
      updated_at: new Date().toISOString(),
    })
    .eq("id", watchId)
    .select("*")
    .single();

  if (error) {
    if (error.message?.includes("include_note_in_prosba")) {
      throw new Error(
        "Brak kolumny include_note_in_prosba — uruchom migrację supabase/migrations/137_zk_watch_include_note_in_prosba.sql"
      );
    }
    throw new Error(error.message);
  }

  let syncedOpenProsbaCount = 0;
  let syncedOrderIds: string[] = [];
  let pendingOpenProsbaCount = 0;

  // Włączenie flagi: bezpiecznie uzupełnij puste uwagi w otwartych prośbach.
  if (include && caseNote) {
    const linked = await fetchAllZkLinkableOrdersForSalesPerson(supabase, salesPersonId);
    const { openOrders, withoutNote } = openZkLinkedOrdersWithCaseNoteState(
      data as SalesZkWatch,
      linked
    );
    const syncIds = resolveZkCaseNoteSyncOrderIds({
      openOrders,
      previousCaseNote: null,
      nextCaseNote: caseNote,
      mode: "safe_from_previous",
    });
    if (syncIds.length) {
      await applyCaseNoteToOpenProsbaOrders(supabase, salesPersonId, syncIds, caseNote);
      syncedOpenProsbaCount = syncIds.length;
      syncedOrderIds = syncIds;
      revalidateZkCaseNoteProsbaPaths();
    } else {
      scheduleNotepadRevalidation();
    }
    pendingOpenProsbaCount = withoutNote.filter((o) => !syncIds.includes(o.id)).length;
  } else {
    scheduleNotepadRevalidation();
  }

  return {
    success: true as const,
    watch: data as SalesZkWatch,
    syncedOpenProsbaCount,
    pendingOpenProsbaCount,
    syncedOrderIds,
  };
}

/**
 * Kopiuje / aktualizuje notatkę sprawy na otwarte powiązane prośby (sales_request_note).
 * Równolegle włącza include_note_in_prosba (przyszłe uzupełnienia też dostaną notatkę).
 */
export async function actionAttachZkWatchNoteToOpenProsba(watchId: string) {
  const salesPersonId = await salesPersonIdForAction();
  const supabase = createAdminClient();

  const { data: row, error: fetchError } = await supabase
    .from("sales_zk_watches")
    .select("*")
    .eq("id", watchId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error("Nie znaleziono wpisu.");
  if (row.sales_person_id !== salesPersonId) {
    throw new Error("Brak uprawnień do tego wpisu.");
  }
  if (row.closed_at || row.archived_at) {
    throw new Error("Nie można dołączać notatki z zamkniętego ZK.");
  }

  const watch = row as SalesZkWatch;
  const caseNote = normalizeZkCaseNote(watch.note);
  if (!caseNote) {
    throw new Error("Brak notatki do sprawy — najpierw ją zapisz.");
  }

  const linked = await fetchAllZkLinkableOrdersForSalesPerson(supabase, salesPersonId);
  const { openOrders, withoutNote } = openZkLinkedOrdersWithCaseNoteState(watch, linked);
  if (!openOrders.length) {
    throw new Error(
      "Brak otwartej prośby powiązanej z tym ZK. Włącz „Dołącz do prośby” i utwórz prośbę."
    );
  }
  if (!withoutNote.length) {
    const { data: already, error: flagError } = await supabase
      .from("sales_zk_watches")
      .update({
        include_note_in_prosba: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", watchId)
      .select("*")
      .single();
    if (flagError) throw new Error(flagError.message);
    scheduleNotepadRevalidation();
    return {
      success: true as const,
      updatedCount: 0,
      watch: already as SalesZkWatch,
      message: "Notatka jest już we wszystkich otwartych prośbach.",
    };
  }

  const ids = resolveZkCaseNoteSyncOrderIds({
    openOrders,
    previousCaseNote: null,
    nextCaseNote: caseNote,
    mode: "force_mismatched",
  });
  await applyCaseNoteToOpenProsbaOrders(supabase, salesPersonId, ids, caseNote);

  const { data: updatedWatch, error: flagError } = await supabase
    .from("sales_zk_watches")
    .update({
      include_note_in_prosba: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", watchId)
    .select("*")
    .single();

  if (flagError) throw new Error(flagError.message);

  revalidateZkCaseNoteProsbaPaths();

  const hadStale = withoutNote.some((o) => normalizeZkCaseNote(o.sales_request_note));
  return {
    success: true as const,
    updatedCount: ids.length,
    watch: updatedWatch as SalesZkWatch,
    message:
      ids.length === 1
        ? hadStale
          ? "Zaktualizowano notatkę w otwartej prośbie — zakupy widzą nową treść."
          : "Dodano notatkę do otwartej prośby — zakupy ją zobaczą."
        : hadStale
          ? `Zaktualizowano notatkę w ${polishPozycjeLabel(ids.length)} — zakupy widzą nową treść.`
          : `Dodano notatkę do ${polishPozycjeLabel(ids.length)} — zakupy ją zobaczą.`,
  };
}

export async function actionUpdateZkWatchLineChecks(
  watchId: string,
  checks: ZkWatchLineCheckStored[]
) {
  const salesPersonId = await salesPersonIdForAction();
  const supabase = createAdminClient();

  const { data: row, error: fetchError } = await supabase
    .from("sales_zk_watches")
    .select("*")
    .eq("id", watchId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error("Nie znaleziono wpisu.");
  if (row.sales_person_id !== salesPersonId) {
    throw new Error("Brak uprawnień do tego wpisu.");
  }
  if (row.closed_at || row.archived_at) {
    throw new Error("Nie można zmieniać listy towaru dla zamkniętego ZK.");
  }

  const views = buildZkWatchLineViews(row as SalesZkWatch);
  const validKeys = new Set(views.map((v) => v.key));
  const previousChecks = parseZkWatchLineChecks((row as SalesZkWatch).line_checks);
  const arrivedByKey = new Map(
    checks
      .filter((c) => validKeys.has(c.key))
      .map((c) => [c.key, Boolean(c.arrived)])
  );
  const shelfMarkedByKey = new Map(
    checks
      .filter((c) => validKeys.has(c.key))
      .map((c) => [c.key, Boolean(c.shelf_marked)])
  );
  const completedManuallyByKey = new Map(
    checks
      .filter((c) => validKeys.has(c.key))
      .map((c) => [c.key, Boolean(c.completed_manually)])
  );
  const sanitized = mergeZkWatchLineChecksPreservingProsbaScope(views, previousChecks, {
    arrivedByKey,
    shelfMarkedByKey,
    completedManuallyByKey,
  });

  const { data, error } = await supabase
    .from("sales_zk_watches")
    .update({
      line_checks: sanitized,
      updated_at: new Date().toISOString(),
    })
    .eq("id", watchId)
    .select("*")
    .single();

  if (error) {
    if (error.message?.includes("line_checks")) {
      throw new Error(
        "Brak kolumny line_checks — uruchom migrację supabase/migrations/051_zk_watch_line_checks.sql"
      );
    }
    throw new Error(error.message);
  }

  scheduleNotepadRevalidation();
  return { watch: data as SalesZkWatch };
}

export async function actionUpdateZkWatchProsbaScope(
  watchId: string,
  lineKeysToOrder: string[]
) {
  const user = await getSessionUser();
  if (!user || !isSalesAccount(user.role)) {
    throw new Error("Wymagane logowanie");
  }

  const supabase = createAdminClient();

  const { data: row, error: fetchError } = await supabase
    .from("sales_zk_watches")
    .select("*")
    .eq("id", watchId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error("Nie znaleziono wpisu.");

  const watch = row as SalesZkWatch;
  const own = await resolveSalesPersonForUser(user);
  const isDelegate = await isProfileActiveDelegateForSalesPerson(
    user.id,
    watch.sales_person_id
  );
  if (own?.id !== watch.sales_person_id && !isDelegate) {
    throw new Error("Brak uprawnień do tego wpisu.");
  }

  if (watch.closed_at || watch.archived_at) {
    throw new Error("Nie można zmieniać zakresu prośby dla zamkniętego ZK.");
  }

  const views = buildZkWatchLineViews(watch);
  const productViews = views.filter((view) => view.key !== "summary");
  if (!productViews.length) {
    throw new Error("Brak pozycji towarowych w tym ZK.");
  }

  const validKeys = new Set(productViews.map((view) => view.key));
  const selected = new Set(lineKeysToOrder.filter((key) => validKeys.has(key)));
  const previousChecks = parseZkWatchLineChecks(watch.line_checks);
  const needsProsbaByKey = new Map<string, boolean>(
    productViews.map((view) => [view.key, selected.has(view.key)])
  );
  const sanitized = mergeZkWatchLineChecksPreservingProsbaScope(views, previousChecks, {
    needsProsbaByKey,
  });

  const watchForDrafts = {
    ...watch,
    line_checks: sanitized,
  };
  const excludedDraftKeys = teethDraftKeysExcludedFromScope(watchForDrafts);
  const nextTeethDrafts = clearZkTeethDraftsForKeys(watch.teeth_drafts, excludedDraftKeys);

  const { data, error } = await supabase
    .from("sales_zk_watches")
    .update({
      line_checks: sanitized,
      teeth_drafts: nextTeethDrafts,
      updated_at: new Date().toISOString(),
    })
    .eq("id", watchId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  scheduleNotepadRevalidation();
  return { watch: data as SalesZkWatch };
}

/** Ustawia needs_prosba tylko dla wskazanych pozycji (np. nowe linie po odświeżeniu ZK). */
export async function actionPatchZkWatchProsbaScopeLines(
  watchId: string,
  lineKeysToOrder: string[],
  affectedLineKeys: string[]
) {
  const salesPersonId = await salesPersonIdForAction();
  const supabase = createAdminClient();

  const { data: row, error: fetchError } = await supabase
    .from("sales_zk_watches")
    .select("*")
    .eq("id", watchId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error("Nie znaleziono wpisu.");
  if (row.sales_person_id !== salesPersonId) {
    throw new Error("Brak uprawnień do tego wpisu.");
  }
  if (row.closed_at || row.archived_at) {
    throw new Error("Nie można zmieniać zakresu prośby dla zamkniętego ZK.");
  }

  const views = buildZkWatchLineViews(row as SalesZkWatch);
  const productViews = views.filter((view) => view.key !== "summary");
  const validKeys = new Set(productViews.map((view) => view.key));
  const selected = new Set(lineKeysToOrder.filter((key) => validKeys.has(key)));
  const affected = affectedLineKeys.filter((key) => validKeys.has(key));
  if (!affected.length) {
    return { watch: row as SalesZkWatch };
  }

  const previousChecks = parseZkWatchLineChecks((row as SalesZkWatch).line_checks);
  const needsProsbaByKey = new Map<string, boolean>(
    affected.map((key) => [key, selected.has(key)])
  );
  const sanitized = mergeZkWatchLineChecksPreservingProsbaScope(views, previousChecks, {
    needsProsbaByKey,
  });

  const watchForDrafts = {
    ...(row as SalesZkWatch),
    line_checks: sanitized,
  };
  const excludedDraftKeys = teethDraftKeysExcludedFromScope(watchForDrafts);
  const nextTeethDrafts = clearZkTeethDraftsForKeys(
    (row as SalesZkWatch).teeth_drafts,
    excludedDraftKeys
  );

  const { data, error } = await supabase
    .from("sales_zk_watches")
    .update({
      line_checks: sanitized,
      teeth_drafts: nextTeethDrafts,
      updated_at: new Date().toISOString(),
    })
    .eq("id", watchId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  scheduleNotepadRevalidation();
  return { watch: data as SalesZkWatch };
}

export async function actionUpdateZkWatchFollowUp(
  watchId: string,
  followUpAt: string | null
) {
  const salesPersonId = await salesPersonIdForAction();
  const supabase = createAdminClient();
  const normalized = followUpAt?.trim().slice(0, 10) || null;

  const { data: row, error: fetchError } = await supabase
    .from("sales_zk_watches")
    .select("id, sales_person_id, closed_at, archived_at")
    .eq("id", watchId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error("Nie znaleziono wpisu.");
  if (row.sales_person_id !== salesPersonId) {
    throw new Error("Brak uprawnień do tego wpisu.");
  }
  if (row.closed_at || row.archived_at) {
    throw new Error("Nie można ustawić przypomnienia dla zamkniętego ZK.");
  }

  const { data, error } = await supabase
    .from("sales_zk_watches")
    .update({ follow_up_at: normalized, updated_at: new Date().toISOString() })
    .eq("id", watchId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  scheduleNotepadRevalidation();
  return { watch: data as SalesZkWatch };
}

export async function actionCreateSalesNote(
  body: string,
  options?: { title?: string | null; color?: SalesNoteColor; follow_up_at?: string | null }
) {
  const salesPersonId = await salesPersonIdForAction();
  const { title, body: normalizedBody } = resolveNoteCreateFields({
    body,
    title: options?.title,
  });

  const followUp =
    options?.follow_up_at?.trim().slice(0, 10) || null;

  const supabase = createAdminClient();

  const { data: topNote } = await supabase
    .from("sales_notes")
    .select("sort_order")
    .eq("sales_person_id", salesPersonId)
    .is("archived_at", null)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  const sortOrder = (topNote?.sort_order ?? 0) - 1;

  const { data, error } = await supabase
    .from("sales_notes")
    .insert({
      sales_person_id: salesPersonId,
      title,
      body: normalizedBody,
      color: options?.color ?? "default",
      follow_up_at: followUp,
      sort_order: sortOrder,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  scheduleNotepadRevalidation();
  return { note: data as SalesNote };
}

export async function actionUpdateSalesNote(
  noteId: string,
  payload: {
    body?: string;
    title?: string | null;
    color?: SalesNoteColor;
    pinned?: boolean;
    follow_up_at?: string | null;
  }
) {
  const salesPersonId = await salesPersonIdForAction();
  const supabase = createAdminClient();

  const { data: row, error: fetchError } = await supabase
    .from("sales_notes")
    .select("id, sales_person_id, title")
    .eq("id", noteId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error("Nie znaleziono notatki.");
  if (row.sales_person_id !== salesPersonId) {
    throw new Error("Brak uprawnień do tej notatki.");
  }

  const contentPatch = resolveNoteUpdateContentFields({
    currentTitle: row.title,
    title: payload.title,
    body: payload.body,
  });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (contentPatch.title !== undefined) patch.title = contentPatch.title;
  if (contentPatch.body !== undefined) patch.body = contentPatch.body;
  if (payload.color !== undefined) patch.color = payload.color;
  if (payload.pinned !== undefined) patch.pinned = payload.pinned;
  if (payload.follow_up_at !== undefined) {
    patch.follow_up_at = payload.follow_up_at?.trim().slice(0, 10) || null;
  }

  const { error } = await supabase.from("sales_notes").update(patch).eq("id", noteId);
  if (error) throw new Error(error.message);
  scheduleNotepadRevalidation();
  return { success: true };
}

export async function actionReorderSalesNotes(
  noteIds: string[],
  options?: { undoPerformedAt?: number }
) {
  const salesPersonId = await salesPersonIdForAction();
  if (!noteIds.length) return { success: true };

  if (options?.undoPerformedAt != null) {
    if (Date.now() - options.undoPerformedAt > UNDO_WINDOW_MS) {
      throw new Error(undoExpiredServerMessage("przy cofaniu kolejności notatek"));
    }
  }

  const uniqueIds = [...new Set(noteIds)];
  const supabase = createAdminClient();

  const { data: rows, error: fetchError } = await supabase
    .from("sales_notes")
    .select("id, sales_person_id, archived_at")
    .in("id", uniqueIds);

  if (fetchError) throw new Error(fetchError.message);
  if (!rows || rows.length !== uniqueIds.length) {
    throw new Error("Nie znaleziono wszystkich notatek do zmiany kolejności.");
  }

  for (const row of rows) {
    if (row.sales_person_id !== salesPersonId) {
      throw new Error("Brak uprawnień do tej notatki.");
    }
    if (row.archived_at) {
      throw new Error("Nie można zmieniać kolejności notatek w archiwum.");
    }
  }

  const { count: activeCount, error: countError } = await supabase
    .from("sales_notes")
    .select("id", { count: "exact", head: true })
    .eq("sales_person_id", salesPersonId)
    .is("archived_at", null);

  if (countError) throw new Error(countError.message);
  if (activeCount !== uniqueIds.length) {
    throw new Error("Niekompletna lista notatek — odśwież stronę i spróbuj ponownie.");
  }

  for (let i = 0; i < uniqueIds.length; i++) {
    const { error } = await supabase
      .from("sales_notes")
      .update({ sort_order: i })
      .eq("id", uniqueIds[i]!);
    if (error) throw new Error(error.message);
  }

  scheduleNotepadRevalidation();
  return { success: true };
}

export async function actionArchiveSalesNote(noteId: string) {
  const salesPersonId = await salesPersonIdForAction();
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: row, error: fetchError } = await supabase
    .from("sales_notes")
    .select("id, sales_person_id")
    .eq("id", noteId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error("Nie znaleziono notatki.");
  if (row.sales_person_id !== salesPersonId) {
    throw new Error("Brak uprawnień do tej notatki.");
  }

  const { error } = await supabase
    .from("sales_notes")
    .update({ archived_at: now, updated_at: now })
    .eq("id", noteId);

  if (error) throw new Error(error.message);
  scheduleNotepadRevalidation();
  return { success: true };
}

export async function actionRestoreSalesNote(
  noteId: string,
  options?: { enforceUndoWindow?: boolean }
) {
  const salesPersonId = await salesPersonIdForAction();
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: row, error: fetchError } = await supabase
    .from("sales_notes")
    .select("id, sales_person_id, archived_at")
    .eq("id", noteId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error("Nie znaleziono notatki.");
  if (row.sales_person_id !== salesPersonId) {
    throw new Error("Brak uprawnień do tej notatki.");
  }
  if (!row.archived_at) throw new Error("Notatka nie jest w archiwum.");

  if (options?.enforceUndoWindow) {
    const archivedAt = new Date(row.archived_at).getTime();
    if (Date.now() - archivedAt > UNDO_WINDOW_MS) {
      throw new Error(undoExpiredServerMessage("przy cofaniu archiwizacji notatki"));
    }
  }

  const { data: topNote } = await supabase
    .from("sales_notes")
    .select("sort_order")
    .eq("sales_person_id", salesPersonId)
    .is("archived_at", null)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  const sortOrder = (topNote?.sort_order ?? 0) - 1;

  const { data, error } = await supabase
    .from("sales_notes")
    .update({ archived_at: null, updated_at: now, sort_order: sortOrder })
    .eq("id", noteId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  scheduleNotepadRevalidation();
  return { note: data as SalesNote };
}

export async function actionDeleteArchivedZkWatch(watchId: string) {
  const salesPersonId = await salesPersonIdForAction();
  const supabase = createAdminClient();

  const { data: row, error: fetchError } = await supabase
    .from("sales_zk_watches")
    .select("id, sales_person_id, closed_at, archived_at")
    .eq("id", watchId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error("Nie znaleziono wpisu.");
  if (row.sales_person_id !== salesPersonId) {
    throw new Error("Brak uprawnień do tego wpisu.");
  }
  if (!row.closed_at && !row.archived_at) {
    throw new Error("Można usunąć tylko zamknięte ZK z archiwum.");
  }

  const { error } = await supabase.from("sales_zk_watches").delete().eq("id", watchId);
  if (error) throw new Error(error.message);
  scheduleNotepadRevalidation();
  return { success: true };
}

export async function actionDeleteArchivedSalesNote(noteId: string) {
  const salesPersonId = await salesPersonIdForAction();
  const supabase = createAdminClient();

  const { data: row, error: fetchError } = await supabase
    .from("sales_notes")
    .select("id, sales_person_id, archived_at")
    .eq("id", noteId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error("Nie znaleziono notatki.");
  if (row.sales_person_id !== salesPersonId) {
    throw new Error("Brak uprawnień do tej notatki.");
  }
  if (!row.archived_at) throw new Error("Można usunąć tylko notatki z archiwum.");

  const { error } = await supabase.from("sales_notes").delete().eq("id", noteId);
  if (error) throw new Error(error.message);
  scheduleNotepadRevalidation();
  return { success: true };
}

/** Zapis szkiców list zębów na ZK (przed prośbą). */
export async function actionSaveZkWatchTeethDrafts(
  watchId: string,
  drafts: Array<{
    lineKey: string;
    subiektTwId: number;
    teethManufacturer: TeethManufacturer | null;
    teethProductLine: TeethProductLine;
    teethKind: TeethKind;
    expectedQuantity: number;
    teethDetails: TeethLineDetail[];
  }>
) {
  const user = await getSessionUser();
  if (!user || !isSalesAccount(user.role)) {
    throw new Error("Wymagane logowanie");
  }

  const supabase = createAdminClient();

  const { data: row, error: fetchError } = await supabase
    .from("sales_zk_watches")
    .select("*")
    .eq("id", watchId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error("Nie znaleziono wpisu.");

  const watch = row as SalesZkWatch;
  const own = await resolveSalesPersonForUser(user);
  const isDelegate = await isProfileActiveDelegateForSalesPerson(
    user.id,
    watch.sales_person_id
  );
  if (own?.id !== watch.sales_person_id && !isDelegate) {
    throw new Error("Brak uprawnień do tego wpisu.");
  }
  if (watch.closed_at || watch.archived_at) {
    throw new Error("Nie można zapisywać list zębów dla zamkniętego ZK.");
  }
  const views = buildZkWatchLineViews(watch);
  const viewByKey = new Map(views.map((v) => [v.key, v]));
  let next = parseZkTeethDrafts(watch.teeth_drafts);
  const now = new Date().toISOString();

  const teethInfo = await fetchTeethProductInfo().catch(() => null);
  if (!teethInfo) {
    throw new Error("Katalog zębów jest chwilowo niedostępny — spróbuj ponownie.");
  }
  const registryIndex = buildTeethRegistryIndex(
    teethInfo.map((row) => ({
      twId: row.twId,
      manufacturer: row.manufacturer,
      productLine: row.productLine,
      kind: row.kind,
      symbol: row.symbol,
      name: row.name,
      plu: row.plu,
    }))
  );

  for (const raw of drafts) {
    const lineKey = raw.lineKey?.trim();
    if (!lineKey || !viewByKey.has(lineKey)) {
      throw new Error("Nieprawidłowa pozycja ZK dla listy zębów.");
    }
    if (!isTeethProductLine(raw.teethProductLine)) {
      throw new Error("Nieprawidłowa linia produktowa zębów.");
    }
    const kind = parseTeethKind(raw.teethKind);
    if (!kind) throw new Error("Wybierz typ zębów (przednie / boczne).");
    if (!Number.isFinite(Math.trunc(Number(raw.subiektTwId))) || Math.trunc(Number(raw.subiektTwId)) <= 0) {
      throw new Error("Brak powiązania z towarem zębów.");
    }
    const resolved = resolveTeethCatalogProduct(
      registryIndex,
      raw.teethProductLine,
      kind
    );
    if (!resolved) {
      throw new Error(
        "Brak towaru w katalogu zębów dla wybranej linii i typu (przednie/boczne) — uzupełnij wpis w adminie."
      );
    }
    const twId = resolved.twId;
    const expectedQuantity = Math.trunc(Number(raw.expectedQuantity));
    if (!Number.isFinite(expectedQuantity) || expectedQuantity < 1) {
      throw new Error("Ilość listy zębów musi być dodatnia.");
    }
    const manufacturer =
      (raw.teethManufacturer && isTeethManufacturer(raw.teethManufacturer)
        ? raw.teethManufacturer
        : null) ??
      resolved.manufacturer ??
      manufacturerForProductLine(raw.teethProductLine);
    const teethDetails = (raw.teethDetails ?? []).map((d, i) => ({
      ...d,
      position: i + 1,
      kind,
    }));

    const draft: ZkTeethLineDraft = {
      lineKey,
      subiektTwId: twId,
      teethManufacturer: manufacturer,
      teethProductLine: resolved.productLine,
      teethKind: kind,
      expectedQuantity,
      teethDetails,
      updatedAt: now,
    };

    if (!teethLineDetailsComplete({
      teethDetails: draft.teethDetails,
      quantity: String(expectedQuantity),
      product: viewByKey.get(lineKey)?.product ?? "",
      subiektTwId: twId,
      adminProductLine: draft.teethProductLine,
      adminManufacturer: draft.teethManufacturer,
      isTeethProduct: true,
    })) {
      throw new Error("Uzupełnij kompletną listę zębów przed zapisem.");
    }
    if (!isZkTeethDraftComplete(draft, viewByKey.get(lineKey)?.quantity ?? expectedQuantity)) {
      throw new Error(
        "Liczba pozycji na liście zębów musi zgadzać się z ilością w ZK."
      );
    }
    next = upsertZkTeethDraft(next, draft);
  }

  const expectedUpdatedAt = watch.updated_at;
  const { data, error } = await supabase
    .from("sales_zk_watches")
    .update({
      teeth_drafts: next,
      updated_at: now,
    })
    .eq("id", watchId)
    .eq("updated_at", expectedUpdatedAt)
    .select("*")
    .maybeSingle();

  if (error) {
    if (error.message?.includes("teeth_drafts")) {
      throw new Error(
        "Brak kolumny teeth_drafts — uruchom migrację supabase/migrations/138_zk_watch_teeth_drafts.sql"
      );
    }
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error(
      "ZK został zaktualizowany w tle — odśwież kartę i zapisz listy zębów ponownie."
    );
  }

  scheduleNotepadRevalidation();
  return { watch: data as SalesZkWatch };
}

/** Usuwa szkice list zębów dla wskazanych lineKey (np. po złożeniu prośby). */
export async function actionClearZkWatchTeethDrafts(
  watchId: string,
  lineKeys: string[]
) {
  const user = await getSessionUser();
  if (!user || !isSalesAccount(user.role)) {
    throw new Error("Wymagane logowanie");
  }
  const supabase = createAdminClient();
  const keys = lineKeys.map((k) => k.trim()).filter(Boolean);
  if (!keys.length) return { watch: null as SalesZkWatch | null };

  const { data: row, error: fetchError } = await supabase
    .from("sales_zk_watches")
    .select("*")
    .eq("id", watchId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error("Nie znaleziono wpisu.");

  const watch = row as SalesZkWatch;
  const own = await resolveSalesPersonForUser(user);
  const isDelegate = await isProfileActiveDelegateForSalesPerson(
    user.id,
    watch.sales_person_id
  );
  if (own?.id !== watch.sales_person_id && !isDelegate) {
    throw new Error("Brak uprawnień do tego wpisu.");
  }
  if (watch.closed_at || watch.archived_at) {
    throw new Error("Nie można czyścić list zębów dla zamkniętego ZK.");
  }

  const next = clearZkTeethDraftsForKeys(watch.teeth_drafts, keys);
  const { data, error } = await supabase
    .from("sales_zk_watches")
    .update({
      teeth_drafts: next,
      updated_at: new Date().toISOString(),
    })
    .eq("id", watchId)
    .eq("updated_at", watch.updated_at)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error(
      "ZK został zaktualizowany w tle — odśwież kartę i spróbuj ponownie."
    );
  }
  scheduleNotepadRevalidation();
  return { watch: data as SalesZkWatch };
}

/** Prefill prośby z karty ZK (np. link z ?zkWatch=). */
export async function actionGetZkProsbaPrefillByWatchId(
  watchId: string,
  salesPersonIdOverride?: string,
  lineKeys?: string[],
  requestKind?: ZkProsbaPrefill["requestKind"],
  mode?: ZkProsbaPrefill["mode"]
): Promise<ZkProsbaPrefill | null> {
  const trimmed = watchId.trim();
  if (!trimmed) return null;

  const user = await getSessionUser();
  if (!user) {
    throw new Error("Wymagane logowanie.");
  }
  if (!isSalesAccount(user.role)) {
    throw new Error("Brak uprawnień handlowca");
  }

  const salesPersonId = await resolveSalesPersonIdForProsbaPrefill(user, salesPersonIdOverride);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_zk_watches")
    .select("*")
    .eq("id", trimmed)
    .eq("sales_person_id", salesPersonId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const watch = nullIfZkWatchClosedForProsba(data as SalesZkWatch);
  if (!watch) {
    return null;
  }
  let teethCatalogAvailable = true;
  const teethInfo = await fetchTeethProductInfo().catch(() => {
    teethCatalogAvailable = false;
    return [];
  });
  const teethRegistry = {
    ...buildTeethDraftRegistryFromProductInfo(teethInfo),
    catalogAvailable: teethCatalogAvailable,
  };
  const options = {
    ...(lineKeys?.length ? { lineKeys } : {}),
    ...(mode === "supplement" || mode === "full" ? { mode } : {}),
    ...(requestKind ? { requestKind } : {}),
    teethRegistry,
  };

  const prefill = zkProsbaPrefillFromWatch(watch, options);
  if (prefill.teethDraftsIncomplete) {
    return prefill;
  }
  return enrichZkProsbaPrefillWithLiveStock(prefill);
}

/** Prefill prośby z ZK po numerze (np. nowa karta — bez sessionStorage). */
export async function actionGetZkProsbaPrefill(
  zkNumber: string,
  salesPersonIdOverride?: string
): Promise<ZkProsbaPrefill | null> {
  const trimmed = zkNumber.trim();
  if (!trimmed) return null;

  const user = await getSessionUser();
  if (!user) {
    throw new Error("Wymagane logowanie.");
  }
  if (!isSalesAccount(user.role)) {
    throw new Error("Brak uprawnień handlowca");
  }

  const salesPersonId = await resolveSalesPersonIdForProsbaPrefill(user, salesPersonIdOverride);

  const supabase = createAdminClient();
  const watchRaw = await fetchZkWatchForProsbaPrefill(supabase, salesPersonId, trimmed);
  const watch = nullIfZkWatchClosedForProsba(watchRaw);
  if (!watch) return null;
  let teethCatalogAvailable = true;
  const teethInfo = await fetchTeethProductInfo().catch(() => {
    teethCatalogAvailable = false;
    return [];
  });
  const teethRegistry = {
    ...buildTeethDraftRegistryFromProductInfo(teethInfo),
    catalogAvailable: teethCatalogAvailable,
  };
  const prefill = zkProsbaPrefillFromWatch(watch, { teethRegistry });
  if (prefill.teethDraftsIncomplete) {
    return prefill;
  }
  return enrichZkProsbaPrefillWithLiveStock(prefill);
}

export type AutoProsbaActionResult = AutoProsbaToastPayload;

/** Automatyczna prośba po zapisie zakresu ZK (checkbox w modalu). */
export async function actionAutoCreateProsbaFromZkWatch(
  watchId: string,
  options?: {
    acknowledgeSufficientStock?: boolean;
    selectedScopeCount?: number;
    delegateFor?: string;
    stockByTwId?: Record<number, import("@/lib/orders/prosba-stock-check").ProsbaLineStockSnapshot>;
  }
): Promise<AutoProsbaActionResult> {
  const user = await getSessionUser();
  if (!user || !isSalesAccount(user.role)) {
    return toastForAutoProsbaBlockedCode("blocked_unauthorized");
  }

  const supabase = createAdminClient();
  const { data: row, error: fetchError } = await supabase
    .from("sales_zk_watches")
    .select("*")
    .eq("id", watchId.trim())
    .maybeSingle();

  if (fetchError) {
    return toastForAutoProsbaBlockedCode(
      "error_generic",
      userFacingErrorText(fetchError, "Nie udało się odczytać ZK.")
    );
  }
  if (!row) {
    return toastForAutoProsbaBlockedCode("blocked_unauthorized");
  }

  const watch = row as SalesZkWatch;
  const own = await resolveSalesPersonForUser(user);
  const isDelegate = await isProfileActiveDelegateForSalesPerson(
    user.id,
    watch.sales_person_id
  );
  const delegateFor = options?.delegateFor?.trim();
  let accessOk =
    own?.id === watch.sales_person_id ||
    isDelegate ||
    (delegateFor === watch.sales_person_id &&
      (await isProfileActiveDelegateForSalesPerson(user.id, delegateFor)));
  if (!accessOk && isSalesManager(user.role)) {
    accessOk = await canAccessSalesPerson(user, watch.sales_person_id);
  }
  if (!accessOk) {
    return toastForAutoProsbaBlockedCode("blocked_unauthorized");
  }

  let teethCatalogAvailable = true;
  const teethInfo = await fetchTeethProductInfo().catch(() => {
    teethCatalogAvailable = false;
    return [];
  });
  const teethRegistry = {
    ...buildTeethDraftRegistryFromProductInfo(teethInfo),
    catalogAvailable: teethCatalogAvailable,
  };

  const linkableOrders = await fetchAllZkLinkableOrdersForSalesPerson(
    supabase,
    watch.sales_person_id
  );
  const hints = computeZkWatchOrderHints(watch, linkableOrders);

  const eligibility = assessZkWatchAutoProsbaEligibility({
    watch,
    hints,
    teethRegistry,
  });
  if (!eligibility.ok) {
    const blocked = toastForAutoProsbaBlockedCode(eligibility.code);
    const mojeHref = buildMojeClientLink(watch.sales_person_id, watch.client_label, {
      clientKhId: watch.client_kh_id,
      zkWatchId: watch.id,
      zkNumber: watch.zk_number,
    });
    if (eligibility.code === "redirect_open_prosba") {
      blocked.actionHref = appendMojeFocusOrderIds(
        mojeHref,
        hints.matchingOpenRequestIds
      );
    } else if (eligibility.code === "skipped_already_covered") {
      blocked.actionHref = mojeHref;
    }
    return blocked;
  }

  const lineKeys = resolveAutoProsbaLineKeys(watch, hints);
  if (!lineKeys.length) {
    const skipped = toastForAutoProsbaBlockedCode("skipped_already_covered");
    skipped.actionHref = buildMojeClientLink(watch.sales_person_id, watch.client_label, {
      clientKhId: watch.client_kh_id,
      zkWatchId: watch.id,
      zkNumber: watch.zk_number,
    });
    return skipped;
  }

  const draftLines = extractProsbaLinesFromZkWatch(watch, { lineKeys });
  const twIds = collectProsbaLineTwIdsMissingStock(draftLines, "zamowienie");
  const clientStockByTwId = resolveClientAutoProsbaStockSnapshot(options?.stockByTwId);
  const stockByTwId =
    clientStockByTwId ?? (twIds.length ? await fetchProsbaLineStock(twIds) : {});
  const lines = buildServerAutoProsbaEntries({ watch, lineKeys, teethRegistry, stockByTwId });

  try {
    await assertCanSubmitIndividualOrders(user, lines);
  } catch (e) {
    return toastForAutoProsbaBlockedCode(
      "blocked_unauthorized",
      userFacingErrorText(e, "Brak uprawnień.")
    );
  }

  try {
    const result = await actionAddIndividualOrders({
      entries: lines,
      acknowledgeSufficientStock: options?.acknowledgeSufficientStock,
      stockByTwId,
    });

    const code = resolveAutoProsbaResultCodeAfterSubmit({
      hints,
      lineKeys,
      selectedScopeCount: options?.selectedScopeCount,
      complete: result.complete,
      verification: result.verification,
    });

    const mojeHref = buildMojeClientLink(watch.sales_person_id, watch.client_label, {
      clientKhId: watch.client_kh_id,
      zkWatchId: watch.id,
      zkNumber: watch.zk_number,
    });
    const actionHref =
      code === "created_supplement" || hints.matchingOpenRequestIds.length
        ? appendMojeFocusOrderIds(mojeHref, hints.matchingOpenRequestIds)
        : mojeHref;

    scheduleNotepadRevalidation();

    return buildAutoProsbaSuccessToast({
      code,
      watch,
      count: result.count,
      complete: result.complete,
      verification: result.verification,
      selectedScopeCount: options?.selectedScopeCount,
      effectiveLineCount: lineKeys.length,
      includeCaseNote: shouldIncludeZkCaseNoteInPrefill(watch),
      actionHref,
    });
  } catch (e) {
    if (e instanceof ProsbaSufficientStockError) {
      return toastForAutoProsbaBlockedCode("error_stock_ack_required", e.message);
    }
    const message = userFacingErrorText(e, "Nie udało się utworzyć prośby.");
    if (message.includes("Trwa inna operacja")) {
      return toastForAutoProsbaBlockedCode("blocked_batch_lock");
    }
    if (message.includes("maks.") || message.includes("30")) {
      return toastForAutoProsbaBlockedCode("blocked_batch_size");
    }
    return toastForAutoProsbaBlockedCode("error_generic", message);
  }
}
