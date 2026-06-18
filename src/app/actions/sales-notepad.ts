"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { isSalesAccount } from "@/lib/auth-roles";
import { canAccessSalesPerson } from "@/lib/data/sales-group-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSubiektZk } from "@/lib/subiekt/api";
import {
  mapZkDocument,
  resolveZkBySubiektDokId,
  searchZkForAdd,
  type ZkSearchCandidate,
} from "@/lib/subiekt/resolve-zk-document";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import { UNDO_WINDOW_MS } from "@/lib/orders/daily-panel-undo";
import {
  buildZkWatchLineViews,
  mergeLineChecksAfterRefresh,
  parseZkWatchLineChecks,
  type ZkWatchLineCheckStored,
} from "@/lib/sales/zk-watch-lines";
import { mergeZkWatchLineChecksPreservingProsbaScope } from "@/lib/sales/zk-watch-prosba-scope";
import { computeZkWatchRefreshDiff } from "@/lib/sales/zk-watch-refresh-diff";
import {
  type ZkProsbaPrefill,
  zkProsbaPrefillFromWatch,
} from "@/lib/orders/zk-watch-prosba-prefill";
import {
  collectZkProsbaScopeLineTwIds,
  filterZkProsbaScopeLineKeysNeedingOrder,
  type ZkProsbaScopeLineInput,
} from "@/lib/orders/prosba-stock-check";
import { actionFetchProsbaLineStock } from "@/app/actions/subiekt";
import { fetchZkWatchForProsbaPrefill } from "@/lib/sales/fetch-zk-watch-for-prefill";
import type { SalesNote, SalesNoteColor, SalesZkWatch } from "@/types/database";

async function salesPersonIdForAction(): Promise<string> {
  const user = await getSessionUser();
  if (!user) throw new Error("Wymagane logowanie");
  if (!isSalesAccount(user.role)) {
    throw new Error("Brak uprawnień do tej operacji.");
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
  if (user.role === "sales" && own?.id !== salesPersonId) {
    throw new Error("Brak uprawnień do prośby tego handlowca.");
  }
  const allowed = await canAccessSalesPerson(user, salesPersonId);
  if (!allowed) {
    throw new Error("Brak uprawnień do prośby tego handlowca.");
  }
  return salesPersonId;
}

function revalidateNotepad() {
  revalidatePath("/notatnik");
  revalidatePath("/zk");
  revalidatePath("/", "layout");
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
  | { kind: "choose"; candidates: ZkSearchCandidate[]; hint: string };

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
    revalidateNotepad();
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

  revalidateNotepad();
  return data as SalesZkWatch;
}

/** Wpisz numer ZK — dodaje obserwację lub zwraca listę do wyboru. */
export async function actionAddZkWatchByNumber(
  zkQuery: string
): Promise<ZkAddWatchResult> {
  await assertSubiektReachableForZk();
  const salesPersonId = await salesPersonIdForAction();
  const result = await searchZkForAdd(zkQuery);

  if (result.kind === "error") throw new Error(result.message);
  if (result.kind === "choose") {
    return {
      kind: "choose",
      candidates: result.candidates,
      hint: result.hint,
    };
  }

  const watch = await persistZkWatch(salesPersonId, result.resolved);
  return { kind: "added", watch };
}

/** Dodaje ZK wybrane z listy kandydatów (po wyszukiwaniu). */
export async function actionAddZkWatchBySubiektDokId(
  subiektDokId: number
): Promise<{ watch: SalesZkWatch }> {
  await assertSubiektReachableForZk();
  const salesPersonId = await salesPersonIdForAction();
  const resolved = await resolveZkBySubiektDokId(subiektDokId);
  const watch = await persistZkWatch(salesPersonId, resolved);
  return { watch };
}

export async function actionCloseZkWatch(watchId: string) {
  const salesPersonId = await salesPersonIdForAction();
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
  revalidateNotepad();
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
  revalidateNotepad();
  return { watch: data as SalesZkWatch };
}

/** Cofnięcie zamknięcia ZK (toast undo) — w odróżnieniu od przywrócenia zachowuje notatkę i przypomnienie. */
export async function actionUndoCloseZkWatch(watchId: string) {
  const salesPersonId = await salesPersonIdForAction();
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
    throw new Error("Minął czas na cofnięcie — odśwież listę.");
  }

  const { data, error } = await supabase
    .from("sales_zk_watches")
    .update({ closed_at: null, archived_at: null, updated_at: now })
    .eq("id", watchId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  revalidateNotepad();
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

  const mergedChecks = mergeLineChecksAfterRefresh(
    parseZkWatchLineChecks((row as SalesZkWatch).line_checks),
    buildZkWatchLineViews({
      ...(row as SalesZkWatch),
      subiekt_snapshot: resolved.snapshot as unknown as Record<string, unknown>,
      line_summary: resolved.lineSummary,
    })
  );

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
      updated_at: now,
    })
    .eq("id", watchId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  revalidateNotepad();
  const refreshedWatch = data as SalesZkWatch;
  const refreshDiff = computeZkWatchRefreshDiff(row as SalesZkWatch, refreshedWatch);
  return { watch: refreshedWatch, refreshDiff };
}

export async function actionUpdateZkWatchNote(watchId: string, note: string) {
  const salesPersonId = await salesPersonIdForAction();
  const supabase = createAdminClient();
  const trimmed = note.trim() || null;

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
    throw new Error("Nie można edytować notatki zamkniętego ZK.");
  }

  const { error } = await supabase
    .from("sales_zk_watches")
    .update({ note: trimmed, updated_at: new Date().toISOString() })
    .eq("id", watchId);

  if (error) throw new Error(error.message);
  revalidateNotepad();
  return { success: true };
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

  revalidateNotepad();
  return { watch: data as SalesZkWatch };
}

export async function actionUpdateZkWatchProsbaScope(
  watchId: string,
  lineKeysToOrder: string[]
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
  if (!productViews.length) {
    throw new Error("Brak pozycji towarowych w tym ZK.");
  }

  const validKeys = new Set(productViews.map((view) => view.key));
  const selected = new Set(lineKeysToOrder.filter((key) => validKeys.has(key)));
  const previousChecks = parseZkWatchLineChecks((row as SalesZkWatch).line_checks);
  const needsProsbaByKey = new Map<string, boolean>(
    productViews.map((view) => [view.key, selected.has(view.key)])
  );
  const sanitized = mergeZkWatchLineChecksPreservingProsbaScope(views, previousChecks, {
    needsProsbaByKey,
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

  if (error) throw new Error(error.message);

  revalidateNotepad();
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
  revalidateNotepad();
  return { watch: data as SalesZkWatch };
}

export async function actionCreateSalesNote(
  body: string,
  options?: { title?: string | null; color?: SalesNoteColor; follow_up_at?: string | null }
) {
  const salesPersonId = await salesPersonIdForAction();
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Notatka nie może być pusta.");

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
      title: options?.title?.trim() || null,
      body: trimmed,
      color: options?.color ?? "default",
      follow_up_at: followUp,
      sort_order: sortOrder,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  revalidateNotepad();
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
    .select("id, sales_person_id")
    .eq("id", noteId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error("Nie znaleziono notatki.");
  if (row.sales_person_id !== salesPersonId) {
    throw new Error("Brak uprawnień do tej notatki.");
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (payload.body !== undefined) {
    const trimmed = payload.body.trim();
    if (!trimmed) throw new Error("Notatka nie może być pusta.");
    patch.body = trimmed;
  }
  if (payload.title !== undefined) patch.title = payload.title?.trim() || null;
  if (payload.color !== undefined) patch.color = payload.color;
  if (payload.pinned !== undefined) patch.pinned = payload.pinned;
  if (payload.follow_up_at !== undefined) {
    patch.follow_up_at = payload.follow_up_at?.trim().slice(0, 10) || null;
  }

  const { error } = await supabase.from("sales_notes").update(patch).eq("id", noteId);
  if (error) throw new Error(error.message);
  revalidateNotepad();
  return { success: true };
}

export async function actionReorderSalesNotes(noteIds: string[]) {
  const salesPersonId = await salesPersonIdForAction();
  if (!noteIds.length) return { success: true };

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

  revalidateNotepad();
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
  revalidateNotepad();
  return { success: true };
}

export async function actionRestoreSalesNote(noteId: string) {
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
  revalidateNotepad();
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
  revalidateNotepad();
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
  revalidateNotepad();
  return { success: true };
}

/** Prefill prośby z karty ZK (np. link z ?zkWatch=). */
export async function actionGetZkProsbaPrefillByWatchId(
  watchId: string,
  salesPersonIdOverride?: string,
  lineKeys?: string[]
): Promise<ZkProsbaPrefill | null> {
  const trimmed = watchId.trim();
  if (!trimmed) return null;

  const user = await getSessionUser();
  if (!user || !isSalesAccount(user.role)) {
    throw new Error("Wymagane logowanie.");
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

  const watch = data as SalesZkWatch;
  let options =
    lineKeys?.length ? { lineKeys, mode: "supplement" as const } : undefined;

  if (options?.lineKeys.length) {
    const lineViews = buildZkWatchLineViews(watch).filter((line) => line.key !== "summary");
    const scopeLines: ZkProsbaScopeLineInput[] = options.lineKeys
      .map((key) => lineViews.find((line) => line.key === key))
      .filter((line) => line != null)
      .map((line) => ({
        key: line!.key,
        subiektTwId: line!.subiektTwId,
        quantity: line!.quantity,
      }));
    const twIds = collectZkProsbaScopeLineTwIds(scopeLines);
    if (twIds.length) {
      const stock = await actionFetchProsbaLineStock(twIds);
      const filteredKeys = filterZkProsbaScopeLineKeysNeedingOrder(
        scopeLines,
        options.lineKeys,
        stock
      );
      options = { ...options, lineKeys: filteredKeys };
    }
  }

  return zkProsbaPrefillFromWatch(watch, options);
}

/** Prefill prośby z ZK po numerze (np. nowa karta — bez sessionStorage). */
export async function actionGetZkProsbaPrefill(
  zkNumber: string,
  salesPersonIdOverride?: string
): Promise<ZkProsbaPrefill | null> {
  const trimmed = zkNumber.trim();
  if (!trimmed) return null;

  const user = await getSessionUser();
  if (!user || !isSalesAccount(user.role)) {
    throw new Error("Wymagane logowanie.");
  }

  const salesPersonId = await resolveSalesPersonIdForProsbaPrefill(user, salesPersonIdOverride);

  const supabase = createAdminClient();
  const watch = await fetchZkWatchForProsbaPrefill(supabase, salesPersonId, trimmed);
  if (!watch) return null;
  return zkProsbaPrefillFromWatch(watch);
}
