"use server";

import { userFacingErrorText } from "@/lib/ui/user-facing-error";
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
  normalizePalletSharesInput,
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
      message: userFacingErrorText(e, "Nie udało się pobrać ZK"),
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
    .from("external_warehouse_line_pallet_shares")
    .delete()
    .eq("zk_link_id", link.id);

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

  // Cała pozycja na jednej palecie — czyści rozbicie (shares).
  const { tryAcquireLock, releaseLock } = await import("@/lib/services/locks");
  const lockKey = `gadki-line-pallet:${link.id}:${lineKey}`;
  const locked = await tryAcquireLock(lockKey, 15, "gadki-line-pallet");
  if (!locked) {
    return {
      ok: false,
      message: "Trwa inna zmiana tej pozycji — spróbuj ponownie za chwilę.",
    };
  }

  try {
    const supabase = createAdminClient();
    // Najpierw meta 1:1 — dopiero potem kasuj shares (żeby awaria meta nie gubiła rozbicia).
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

    const { error: clearSharesError } = await supabase
      .from("external_warehouse_line_pallet_shares")
      .delete()
      .eq("zk_link_id", link.id)
      .eq("line_key", lineKey);
    if (clearSharesError) return { ok: false, message: clearSharesError.message };

    await supabase.from("external_warehouse_change_log").insert({
      site_id: site.id,
      zk_link_id: link.id,
      kind: "pallet_changed",
      summary: pallet
        ? `${link.zk_number}: paleta „${pallet}”`
        : `${link.zk_number}: usunięto paletę`,
      meta: { line_key: lineKey, pallet_label: pallet, cleared_shares: true },
      actor_user_id: user.id,
    });

    revalidateGadki();
    return { ok: true };
  } finally {
    await releaseLock(lockKey);
  }
}

/**
 * Rozbicie pozycji ZK na kilka nazwanych palet (replace-all udziałów).
 * Pusta lista = usuń same udziały (nie rusza meta.pallet_label — 1:1 zostaje).
 */
export async function actionSetGadkiLinePalletShares(input: {
  linkId: string;
  lineKey: string;
  shares: { palletLabel: string; qty: number; note?: string | null }[];
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireOperations("mutate");
  const site = await requireGadkiSite();
  const link = await requireSiteScopedLink(input.linkId, site.id);

  const normalized = normalizePalletSharesInput(
    link.last_snapshot,
    input.lineKey,
    input.shares ?? []
  );
  if (!normalized.ok) return normalized;
  const lineKey = input.lineKey.trim();
  const shares = normalized.shares;

  const { tryAcquireLock, releaseLock } = await import("@/lib/services/locks");
  const lockKey = `gadki-line-pallet:${link.id}:${lineKey}`;
  const locked = await tryAcquireLock(lockKey, 15, "gadki-line-pallet");
  if (!locked) {
    return {
      ok: false,
      message: "Trwa inna zmiana tej pozycji — spróbuj ponownie za chwilę.",
    };
  }

  try {
    const supabase = createAdminClient();
    const { error: rpcError } = await supabase.rpc(
      "replace_external_warehouse_line_pallet_shares",
      {
        p_zk_link_id: link.id,
        p_line_key: lineKey,
        p_shares: shares.map((s) => ({
          pallet_label: s.palletLabel,
          qty: s.qty,
          note: s.note,
        })),
        p_updated_by: user.id,
        p_max_qty: normalized.lineQty,
      }
    );

    if (rpcError) {
      if (
        rpcError.message.includes("shares_exceed_line_qty") ||
        rpcError.message.includes("too_many_shares") ||
        rpcError.message.includes("invalid_share") ||
        rpcError.message.includes("share_note_too_long")
      ) {
        return {
          ok: false,
          message: rpcError.message.includes("shares_exceed_line_qty")
            ? "Suma udziałów przekracza ilość w ZK"
            : rpcError.message.includes("too_many_shares")
              ? "Za dużo palet na jedną pozycję"
              : rpcError.message.includes("share_note_too_long")
                ? "Notatka udziału jest za długa"
                : "Nieprawidłowe udziały palet",
        };
      }
      return { ok: false, message: rpcError.message };
    }

    const shareSummary = shares.length
      ? shares.map((s) => `„${s.palletLabel}”×${s.qty}`).join(", ")
      : "wyczyszczono";

    await supabase.from("external_warehouse_change_log").insert({
      site_id: site.id,
      zk_link_id: link.id,
      kind: "pallet_shares_changed",
      summary: `${link.zk_number}: rozbicie pozycji (${shareSummary})`,
      meta: {
        line_key: lineKey,
        shares: shares.map((s) => ({
          pallet_label: s.palletLabel,
          qty: s.qty,
          note: s.note,
        })),
      },
      actor_user_id: user.id,
    });

    revalidateGadki();
    return { ok: true };
  } finally {
    await releaseLock(lockKey);
  }
}

export async function actionSetGadkiLineNote(input: {
  linkId: string;
  lineKey: string;
  note: string | null;
  /** Gdy podane — notatka dotyczy konkretnego udziału palety. */
  shareId?: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireOperations("mutate");
  const site = await requireGadkiSite();
  const link = await requireSiteScopedLink(input.linkId, site.id);

  const keyCheck = assertLineKeyInSnapshot(link.last_snapshot, input.lineKey);
  if (!keyCheck.ok) return keyCheck;
  const lineKey = input.lineKey.trim();

  const note = normalizeLineNote(input.note);
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const shareId = input.shareId?.trim() || null;
  if (shareId) {
    if (!isExternalWarehouseUuid(shareId)) {
      return { ok: false, message: "Nieprawidłowy udział palety" };
    }
    const { data: share, error: shareFetchError } = await supabase
      .from("external_warehouse_line_pallet_shares")
      .select("id")
      .eq("id", shareId)
      .eq("zk_link_id", link.id)
      .eq("line_key", lineKey)
      .maybeSingle();
    if (shareFetchError) return { ok: false, message: shareFetchError.message };
    if (!share) return { ok: false, message: "Udział palety nie znaleziony" };

    const { error } = await supabase
      .from("external_warehouse_line_pallet_shares")
      .update({
        note,
        updated_by: user.id,
        updated_at: now,
      })
      .eq("id", shareId)
      .eq("zk_link_id", link.id)
      .eq("line_key", lineKey);
    if (error) return { ok: false, message: error.message };

    await supabase.from("external_warehouse_change_log").insert({
      site_id: site.id,
      zk_link_id: link.id,
      kind: "line_note",
      summary: `${link.zk_number}: notatka udziału palety`,
      meta: { line_key: lineKey, share_id: shareId },
      actor_user_id: user.id,
    });

    revalidateGadki();
    return { ok: true };
  }

  // Update-only notatki pozycji (nie nadpisuje pallet_label). Brak wiersza → insert.
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
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("external_warehouse_line_meta")
    .update({
      pallet_label: to,
      updated_by: user.id,
      updated_at: now,
    })
    .eq("zk_link_id", link.id)
    .eq("pallet_label", from)
    .select("id");

  if (error) return { ok: false, message: error.message };
  const metaUpdated = data?.length ?? 0;

  const { data: fromShares, error: fromSharesError } = await supabase
    .from("external_warehouse_line_pallet_shares")
    .select("id, line_key, qty, note")
    .eq("zk_link_id", link.id)
    .eq("pallet_label", from);
  if (fromSharesError) return { ok: false, message: fromSharesError.message };

  let shareUpdated = 0;
  for (const share of fromShares ?? []) {
    const { data: target, error: targetError } = await supabase
      .from("external_warehouse_line_pallet_shares")
      .select("id, qty, note")
      .eq("zk_link_id", link.id)
      .eq("line_key", share.line_key)
      .eq("pallet_label", to)
      .maybeSingle();
    if (targetError) return { ok: false, message: targetError.message };

    if (target) {
      const nextQty =
        Math.round((Number(target.qty) + Number(share.qty)) * 10000) / 10000;
      const sourceNote =
        typeof share.note === "string" ? share.note.trim() || null : null;
      const targetNote =
        typeof target.note === "string" ? target.note.trim() || null : null;
      const mergedNote =
        !sourceNote
          ? targetNote
          : !targetNote || targetNote === sourceNote
            ? sourceNote
            : `${targetNote}; ${sourceNote}`.slice(0, 2000);
      const { error: mergeError } = await supabase
        .from("external_warehouse_line_pallet_shares")
        .update({
          qty: nextQty,
          note: mergedNote,
          updated_by: user.id,
          updated_at: now,
        })
        .eq("id", target.id);
      if (mergeError) return { ok: false, message: mergeError.message };
      const { error: delError } = await supabase
        .from("external_warehouse_line_pallet_shares")
        .delete()
        .eq("id", share.id);
      if (delError) return { ok: false, message: delError.message };
    } else {
      const { error: renameError } = await supabase
        .from("external_warehouse_line_pallet_shares")
        .update({
          pallet_label: to,
          updated_by: user.id,
          updated_at: now,
        })
        .eq("id", share.id);
      if (renameError) return { ok: false, message: renameError.message };
    }
    shareUpdated += 1;
  }

  const updated = metaUpdated + shareUpdated;

  if (updated > 0) {
    await supabase.from("external_warehouse_change_log").insert({
      site_id: site.id,
      zk_link_id: link.id,
      kind: "pallet_renamed",
      summary: `${link.zk_number}: „${from}” → „${to}” (${updated})`,
      meta: {
        from,
        to,
        count: updated,
        meta_count: metaUpdated,
        share_count: shareUpdated,
      },
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
  const { error: shareDelError } = await supabase
    .from("external_warehouse_line_pallet_shares")
    .delete()
    .eq("zk_link_id", link.id)
    .eq("line_key", lineKey);
  if (shareDelError) return { ok: false, message: shareDelError.message };

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
