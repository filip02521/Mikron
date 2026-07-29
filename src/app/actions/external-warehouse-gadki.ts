"use server";

// @service-role-ok — autoryzacja requireOperations(); service role z pełnym scope po warstwie aplikacji.

import { revalidatePath } from "next/cache";
import { requireOperations } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  searchZkForAdd,
  resolveZkBySubiektDokId,
  type ZkSearchCandidate,
} from "@/lib/subiekt/resolve-zk-document";
import { validateZkQueryForSubmit } from "@/lib/subiekt/zk-search";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import {
  GADKI_PAGE_PATH,
  MAX_EXTERNAL_WAREHOUSE_ZK_LINKS,
} from "@/lib/external-warehouse/constants";
import {
  assertLineKeyInSnapshot,
  assertOrphanLineKey,
  assertUnderZkLinkLimit,
  isExternalWarehouseUuid,
  normalizeLineNote,
  normalizePalletLabel,
  normalizeSiteNoteBody,
  normalizeZkLabel,
} from "@/lib/external-warehouse/guards";
import { syncExternalWarehouseZkLink } from "@/lib/external-warehouse/sync";
import {
  countZkLinksForSite,
  ensureGadkiSite,
  fetchZkLinkForSite,
} from "@/lib/data/external-warehouse-gadki";
import type { SyncLinkResult } from "@/lib/external-warehouse/sync";

function revalidateGadki() {
  revalidatePath(GADKI_PAGE_PATH);
}

async function requireGadkiSite() {
  const site = await ensureGadkiSite();
  return site;
}

async function requireSiteScopedLink(linkId: string, siteId: string) {
  if (!isExternalWarehouseUuid(linkId)) {
    throw new Error("Nieprawidłowy identyfikator ZK");
  }
  const link = await fetchZkLinkForSite(linkId, siteId);
  if (!link) throw new Error("ZK nie należy do magazynu Gądki");
  return link;
}

export async function actionSearchGadkiZk(query: string): Promise<
  | { kind: "single"; dokId: number; zkNumber: string; clientLabel: string }
  | { kind: "choose"; candidates: ZkSearchCandidate[]; hint: string }
  | { kind: "error"; message: string }
> {
  await requireOperations("mutate");
  const validated = validateZkQueryForSubmit(query);
  if (!validated.ok) return { kind: "error", message: validated.message };

  if (!(await isSubiektReachable())) {
    return {
      kind: "error",
      message: "System magazynowy niedostępny — spróbuj ponownie później.",
    };
  }

  const result = await searchZkForAdd(validated.normalized);
  if (result.kind === "error") return result;
  if (result.kind === "choose") {
    return {
      kind: "choose",
      candidates: result.candidates,
      hint: result.hint,
    };
  }
  return {
    kind: "single",
    dokId: result.resolved.subiektDokId,
    zkNumber: result.resolved.zkNumber,
    clientLabel: result.resolved.clientLabel,
  };
}

export async function actionLinkGadkiZk(input: {
  subiektDokId: number;
  label?: string | null;
}): Promise<{ ok: true; linkId: string } | { ok: false; message: string }> {
  const user = await requireOperations("mutate");
  const site = await requireGadkiSite();

  const dokId = Math.trunc(Number(input.subiektDokId));
  if (!Number.isFinite(dokId) || dokId <= 0) {
    return { ok: false, message: "Nieprawidłowy identyfikator dokumentu ZK" };
  }

  if (!(await isSubiektReachable())) {
    return {
      ok: false,
      message: "System magazynowy niedostępny — spróbuj ponownie później.",
    };
  }

  const count = await countZkLinksForSite(site.id);
  const limit = assertUnderZkLinkLimit(count);
  if (!limit.ok) return limit;

  let resolved;
  try {
    resolved = await resolveZkBySubiektDokId(dokId);
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Nie udało się pobrać ZK",
    };
  }

  const label = normalizeZkLabel(input.label);

  // Krótki lock procesu — razem z triggerem DB chroni przed race >10 ZK.
  const { tryAcquireLock, releaseLock } = await import("@/lib/services/locks");
  const linkLockKey = `gadki-zk-link:${site.id}`;
  const locked = await tryAcquireLock(linkLockKey, 15, "gadki-zk-link");
  if (!locked) {
    return {
      ok: false,
      message: "Trwa inne powiązanie ZK — spróbuj ponownie za chwilę.",
    };
  }

  try {
    const recount = await countZkLinksForSite(site.id);
    const recountLimit = assertUnderZkLinkLimit(recount);
    if (!recountLimit.ok) return recountLimit;

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("external_warehouse_zk_links")
      .insert({
        site_id: site.id,
        subiekt_dok_id: resolved.subiektDokId,
        zk_number: resolved.zkNumber,
        client_label: resolved.clientLabel,
        label,
        sort_order: recount,
      })
      .select("id")
      .single();

    if (error) {
      if (
        error.code === "23505" ||
        error.message.includes("external_warehouse_zk_links_site_dok_uid")
      ) {
        return { ok: false, message: "To ZK jest już powiązane z magazynem" };
      }
      if (
        error.message.includes("max_external_warehouse_zk_links") ||
        error.code === "23514"
      ) {
        return {
          ok: false,
          message: `Maksymalnie ${MAX_EXTERNAL_WAREHOUSE_ZK_LINKS} ZK na magazyn`,
        };
      }
      return { ok: false, message: error.message };
    }

    const linkId = data.id as string;

    await supabase.from("external_warehouse_change_log").insert({
      site_id: site.id,
      zk_link_id: linkId,
      kind: "zk_linked",
      summary: `Powiązano ZK ${resolved.zkNumber}`,
      meta: { subiekt_dok_id: resolved.subiektDokId },
      actor_user_id: user.id,
    });

    const link = await fetchZkLinkForSite(linkId, site.id);
    if (link) {
      await syncExternalWarehouseZkLink(link, {
        force: true,
        actorUserId: user.id,
      });
    }

    revalidateGadki();
    return { ok: true, linkId };
  } finally {
    await releaseLock(linkLockKey);
  }
}

export async function actionUnlinkGadkiZk(
  linkId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireOperations("mutate");
  const site = await requireGadkiSite();
  const link = await requireSiteScopedLink(linkId, site.id);

  const supabase = createAdminClient();

  await supabase
    .from("external_warehouse_line_meta")
    .delete()
    .eq("zk_link_id", link.id);

  await supabase
    .from("external_warehouse_notes")
    .delete()
    .eq("zk_link_id", link.id);

  const { error } = await supabase
    .from("external_warehouse_zk_links")
    .delete()
    .eq("id", link.id)
    .eq("site_id", site.id);

  if (error) return { ok: false, message: error.message };

  await supabase.from("external_warehouse_change_log").insert({
    site_id: site.id,
    zk_link_id: null,
    kind: "zk_unlinked",
    summary: `Odłączono ZK ${link.zk_number}`,
    meta: {
      subiekt_dok_id: link.subiekt_dok_id,
      zk_number: link.zk_number,
    },
    actor_user_id: user.id,
  });

  revalidateGadki();
  return { ok: true };
}

export async function actionRefreshGadkiZk(options?: {
  linkId?: string;
}): Promise<{ results: SyncLinkResult[] }> {
  const user = await requireOperations("mutate");
  const site = await requireGadkiSite();
  const supabase = createAdminClient();

  let query = supabase
    .from("external_warehouse_zk_links")
    .select("*")
    .eq("site_id", site.id);

  if (options?.linkId) {
    // IDOR: link musi należeć do site gadki (nie wystarczy sam UUID).
    await requireSiteScopedLink(options.linkId, site.id);
    query = query.eq("id", options.linkId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const links = data ?? [];

  const { syncExternalWarehouseZkLinks } = await import(
    "@/lib/external-warehouse/sync"
  );
  const results = await syncExternalWarehouseZkLinks(links, {
    force: true,
    actorUserId: user.id,
  });

  revalidateGadki();
  return { results };
}

export async function actionSetGadkiLinePallet(input: {
  linkId: string;
  lineKey: string;
  palletLabel: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireOperations("mutate");
  const site = await requireGadkiSite();
  const link = await requireSiteScopedLink(input.linkId, site.id);

  const keyCheck = assertLineKeyInSnapshot(link.last_snapshot, input.lineKey);
  if (!keyCheck.ok) return keyCheck;
  const lineKey = input.lineKey.trim();

  const pallet = normalizePalletLabel(input.palletLabel);

  // Update-only pola palety (nie nadpisuje note). Brak wiersza → insert.
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("external_warehouse_line_meta")
    .update({
      pallet_label: pallet,
      updated_by: user.id,
      updated_at: now,
    })
    .eq("zk_link_id", link.id)
    .eq("line_key", lineKey)
    .select("id");

  if (updateError) return { ok: false, message: updateError.message };

  if (!updated?.length) {
    const { error: insertError } = await supabase
      .from("external_warehouse_line_meta")
      .insert({
        zk_link_id: link.id,
        line_key: lineKey,
        pallet_label: pallet,
        updated_by: user.id,
        updated_at: now,
      });
    if (insertError) {
      if (insertError.code === "23505") {
        const { error: retryError } = await supabase
          .from("external_warehouse_line_meta")
          .update({
            pallet_label: pallet,
            updated_by: user.id,
            updated_at: now,
          })
          .eq("zk_link_id", link.id)
          .eq("line_key", lineKey);
        if (retryError) return { ok: false, message: retryError.message };
      } else {
        return { ok: false, message: insertError.message };
      }
    }
  }

  await supabase.from("external_warehouse_change_log").insert({
    site_id: site.id,
    zk_link_id: link.id,
    kind: "pallet_changed",
    summary: pallet
      ? `${link.zk_number}: paleta „${pallet}”`
      : `${link.zk_number}: usunięto paletę`,
    meta: { line_key: lineKey, pallet_label: pallet },
    actor_user_id: user.id,
  });

  revalidateGadki();
  return { ok: true };
}

export async function actionSetGadkiLineNote(input: {
  linkId: string;
  lineKey: string;
  note: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireOperations("mutate");
  const site = await requireGadkiSite();
  const link = await requireSiteScopedLink(input.linkId, site.id);

  const keyCheck = assertLineKeyInSnapshot(link.last_snapshot, input.lineKey);
  if (!keyCheck.ok) return keyCheck;
  const lineKey = input.lineKey.trim();

  const note = normalizeLineNote(input.note);

  // Update-only notatki (nie nadpisuje pallet_label). Brak wiersza → insert.
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("external_warehouse_line_meta")
    .update({
      note,
      updated_by: user.id,
      updated_at: now,
    })
    .eq("zk_link_id", link.id)
    .eq("line_key", lineKey)
    .select("id");

  if (updateError) return { ok: false, message: updateError.message };

  if (!updated?.length) {
    const { error: insertError } = await supabase
      .from("external_warehouse_line_meta")
      .insert({
        zk_link_id: link.id,
        line_key: lineKey,
        note,
        updated_by: user.id,
        updated_at: now,
      });
    if (insertError) {
      if (insertError.code === "23505") {
        const { error: retryError } = await supabase
          .from("external_warehouse_line_meta")
          .update({
            note,
            updated_by: user.id,
            updated_at: now,
          })
          .eq("zk_link_id", link.id)
          .eq("line_key", lineKey);
        if (retryError) return { ok: false, message: retryError.message };
      } else {
        return { ok: false, message: insertError.message };
      }
    }
  }

  await supabase.from("external_warehouse_change_log").insert({
    site_id: site.id,
    zk_link_id: link.id,
    kind: "line_note",
    summary: `${link.zk_number}: notatka pozycji`,
    meta: { line_key: lineKey },
    actor_user_id: user.id,
  });

  revalidateGadki();
  return { ok: true };
}

export async function actionRenameGadkiPallet(input: {
  linkId: string;
  fromLabel: string;
  toLabel: string;
}): Promise<{ ok: true; updated: number } | { ok: false; message: string }> {
  const user = await requireOperations("mutate");
  const site = await requireGadkiSite();
  const link = await requireSiteScopedLink(input.linkId, site.id);

  const from = normalizePalletLabel(input.fromLabel) ?? "";
  const to = normalizePalletLabel(input.toLabel) ?? "";
  if (!from || !to) {
    return { ok: false, message: "Podaj starą i nową nazwę palety" };
  }
  if (from === to) return { ok: true, updated: 0 };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("external_warehouse_line_meta")
    .update({
      pallet_label: to,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("zk_link_id", link.id)
    .eq("pallet_label", from)
    .select("id");

  if (error) return { ok: false, message: error.message };
  const updated = data?.length ?? 0;

  if (updated > 0) {
    await supabase.from("external_warehouse_change_log").insert({
      site_id: site.id,
      zk_link_id: link.id,
      kind: "pallet_renamed",
      summary: `${link.zk_number}: „${from}” → „${to}” (${updated})`,
      meta: { from, to, count: updated },
      actor_user_id: user.id,
    });
  }

  revalidateGadki();
  return { ok: true, updated };
}

export async function actionPurgeGadkiOrphanMeta(input: {
  linkId: string;
  lineKey: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireOperations("mutate");
  const site = await requireGadkiSite();
  const link = await requireSiteScopedLink(input.linkId, site.id);

  const orphanCheck = assertOrphanLineKey(link.last_snapshot, input.lineKey);
  if (!orphanCheck.ok) return orphanCheck;
  const lineKey = input.lineKey.trim();

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("external_warehouse_line_meta")
    .delete()
    .eq("zk_link_id", link.id)
    .eq("line_key", lineKey);

  if (error) return { ok: false, message: error.message };

  await supabase.from("external_warehouse_change_log").insert({
    site_id: site.id,
    zk_link_id: link.id,
    kind: "line_note",
    summary: `${link.zk_number}: usunięto meta orphan`,
    meta: { line_key: lineKey, purged: true },
    actor_user_id: user.id,
  });

  revalidateGadki();
  return { ok: true };
}

export async function actionAddGadkiSiteNote(input: {
  body: string;
  zkLinkId?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const user = await requireOperations("mutate");
  const site = await requireGadkiSite();

  const body = normalizeSiteNoteBody(input.body);
  if (!body) return { ok: false, message: "Notatka nie może być pusta" };

  let zkLinkId: string | null = null;
  if (input.zkLinkId) {
    const link = await requireSiteScopedLink(input.zkLinkId, site.id);
    zkLinkId = link.id;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("external_warehouse_notes")
    .insert({
      site_id: site.id,
      zk_link_id: zkLinkId,
      body,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { ok: false, message: error.message };

  await supabase.from("external_warehouse_change_log").insert({
    site_id: site.id,
    zk_link_id: zkLinkId,
    kind: "site_note",
    summary: "Dodano notatkę magazynu",
    meta: { note_id: data.id },
    actor_user_id: user.id,
  });

  revalidateGadki();
  return { ok: true, id: data.id };
}

export async function actionUpdateGadkiSiteNote(input: {
  noteId: string;
  body: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireOperations("mutate");
  const site = await requireGadkiSite();
  const noteId = input.noteId.trim();
  if (!isExternalWarehouseUuid(noteId)) {
    return { ok: false, message: "Nieprawidłowa notatka" };
  }

  const body = normalizeSiteNoteBody(input.body);
  if (!body) return { ok: false, message: "Notatka nie może być pusta" };

  const supabase = createAdminClient();
  const { data: existing, error: fetchErr } = await supabase
    .from("external_warehouse_notes")
    .select("id")
    .eq("id", noteId)
    .eq("site_id", site.id)
    .is("archived_at", null)
    .maybeSingle();
  if (fetchErr) return { ok: false, message: fetchErr.message };
  if (!existing) return { ok: false, message: "Notatka nie znaleziona" };

  const { error } = await supabase
    .from("external_warehouse_notes")
    .update({ body, updated_at: new Date().toISOString() })
    .eq("id", noteId)
    .eq("site_id", site.id);

  if (error) return { ok: false, message: error.message };

  await supabase.from("external_warehouse_change_log").insert({
    site_id: site.id,
    zk_link_id: null,
    kind: "site_note",
    summary: "Zaktualizowano notatkę magazynu",
    meta: { note_id: noteId },
    actor_user_id: user.id,
  });

  revalidateGadki();
  return { ok: true };
}

export async function actionDeleteGadkiSiteNote(
  noteId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireOperations("mutate");
  const site = await requireGadkiSite();
  const id = noteId.trim();
  if (!isExternalWarehouseUuid(id)) {
    return { ok: false, message: "Nieprawidłowa notatka" };
  }

  const supabase = createAdminClient();
  const { data: existing, error: fetchErr } = await supabase
    .from("external_warehouse_notes")
    .select("id")
    .eq("id", id)
    .eq("site_id", site.id)
    .is("archived_at", null)
    .maybeSingle();
  if (fetchErr) return { ok: false, message: fetchErr.message };
  if (!existing) return { ok: false, message: "Notatka nie znaleziona" };

  const { error } = await supabase
    .from("external_warehouse_notes")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("site_id", site.id);

  if (error) return { ok: false, message: error.message };

  await supabase.from("external_warehouse_change_log").insert({
    site_id: site.id,
    zk_link_id: null,
    kind: "site_note",
    summary: "Usunięto notatkę magazynu",
    meta: { note_id: id, archived: true },
    actor_user_id: user.id,
  });

  revalidateGadki();
  return { ok: true };
}
