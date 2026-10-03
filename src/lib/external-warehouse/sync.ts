import { getSubiektZk } from "@/lib/subiekt/api";
import { SubiektRequestError } from "@/lib/subiekt/errors";
import { mapZkDocument, searchZkForAdd, type ResolvedZkDocument } from "@/lib/subiekt/resolve-zk-document";
import { getSubiektAvailability } from "@/lib/subiekt/availability";
import { feedbackFromException } from "@/lib/subiekt/feedback";
import { createAdminClient } from "@/lib/supabase/admin";
import { tryAcquireLock, releaseLock } from "@/lib/services/locks";
import {
  EXTERNAL_WAREHOUSE_SYNC_CONCURRENCY,
  EXTERNAL_WAREHOUSE_SYNC_DEBOUNCE_MS,
  EXTERNAL_WAREHOUSE_SYNC_LOCK_TTL_SEC,
  gadkiZkSyncLockKey,
} from "@/lib/external-warehouse/constants";
import {
  hashExternalWarehouseLines,
  parsePrunedSnapshot,
  pruneSubiektZkSnapshot,
  type ExternalWarehousePrunedSnapshot,
} from "@/lib/external-warehouse/lines";
import {
  computeExternalWarehouseRefreshDiff,
  hasExternalWarehouseRefreshDiff,
  type ExternalWarehouseRefreshDiff,
} from "@/lib/external-warehouse/diff";
import { rematchMetaAfterZkDiff } from "@/lib/external-warehouse/apply-line-key-rematch";
import { buildZkDiffChangeLogEntries } from "@/lib/external-warehouse/change-log-copy";
import {
  describeShareRebalance,
  planShareRebalance,
} from "@/lib/external-warehouse/share-rebalance";
import type { ExternalWarehouseZkLink } from "@/types/database";

export type SyncLinkResult = {
  linkId: string;
  zkNumber: string;
  status:
    | "synced"
    | "unchanged"
    | "debounced"
    | "locked"
    | "unavailable"
    | "cas_conflict"
    /** ZK nie ma już w Subiekcie (usunięte / zastąpione) i nie znaleziono następcy po numerze. */
    | "missing"
    | "error";
  diff: ExternalWarehouseRefreshDiff | null;
  error?: string;
  lastSyncedAt?: string | null;
  /** ZK podmienione automatycznie na nowy dokument Subiekta o tym samym numerze. */
  replacedDokId?: number;
  /** Pozycje, w których palety skorygowano do nowej ilości ZK. */
  rebalanced?: number;
};

export type SyncableZkLink = Pick<
  ExternalWarehouseZkLink,
  | "id"
  | "site_id"
  | "subiekt_dok_id"
  | "zk_number"
  | "client_label"
  | "last_snapshot"
  | "snapshot_hash"
  | "last_synced_at"
> &
  Partial<Pick<ExternalWarehouseZkLink, "last_sync_attempt_at">>;

function shouldSkipDebounce(
  lastSyncedAt: string | null | undefined,
  force: boolean,
  nowMs: number
): boolean {
  if (force) return false;
  if (!lastSyncedAt) return false;
  const prev = Date.parse(lastSyncedAt);
  if (!Number.isFinite(prev)) return false;
  return nowMs - prev < EXTERNAL_WAREHOUSE_SYNC_DEBOUNCE_MS;
}

async function casUpdateZkLink(input: {
  linkId: string;
  prevSyncedAt: string | null;
  patch: Record<string, unknown>;
}): Promise<boolean> {
  const supabase = createAdminClient();
  let query = supabase
    .from("external_warehouse_zk_links")
    .update(input.patch)
    .eq("id", input.linkId);

  if (input.prevSyncedAt == null) {
    query = query.is("last_synced_at", null);
  } else {
    query = query.eq("last_synced_at", input.prevSyncedAt);
  }

  const { data, error } = await query.select("id").maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data?.id);
}

/**
 * Nowe rodzaje wpisów (migracja 161) mają odpowiednik sprzed migracji — gdy CHECK w bazie
 * jeszcze ich nie zna, wpis i tak trafia do dziennika.
 */
const CHANGE_LOG_KIND_FALLBACK: Record<string, string> = {
  line_changed: "qty_changed",
  zk_replaced: "zk_linked",
  shares_rebalanced: "pallet_shares_changed",
};

async function appendChangeLog(
  entries: {
    siteId: string;
    zkLinkId: string;
    kind: string;
    summary: string;
    meta?: Record<string, unknown>;
    actorUserId?: string | null;
  }[]
): Promise<void> {
  if (!entries.length) return;
  const supabase = createAdminClient();
  const { error } = await supabase.from("external_warehouse_change_log").insert(
    entries.map((e) => ({
      site_id: e.siteId,
      zk_link_id: e.zkLinkId,
      kind: e.kind,
      summary: e.summary,
      meta: e.meta ?? {},
      actor_user_id: e.actorUserId ?? null,
    }))
  );
  if (!error) return;
  if (entries.some((e) => CHANGE_LOG_KIND_FALLBACK[e.kind])) {
    const { error: retryError } = await supabase.from("external_warehouse_change_log").insert(
      entries.map((e) => ({
        site_id: e.siteId,
        zk_link_id: e.zkLinkId,
        kind: CHANGE_LOG_KIND_FALLBACK[e.kind] ?? e.kind,
        summary: e.summary,
        meta: e.meta ?? {},
        actor_user_id: e.actorUserId ?? null,
      }))
    );
    if (!retryError) return;
  }
  console.error("[external-warehouse] change_log", error.message);
}

/**
 * Stan synchronizacji w UI (migracja 161). Zapis osobno i bez wywracania syncu —
 * przed migracją kolumn nie ma, a pozycje i tak muszą się aktualizować.
 */
async function recordSyncStatus(
  linkId: string,
  status: { error: string | null; at: string }
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("external_warehouse_zk_links")
    .update({
      last_sync_attempt_at: status.at,
      last_sync_error: status.error ? status.error.slice(0, 500) : null,
      last_sync_error_at: status.error ? status.at : null,
    })
    .eq("id", linkId);
  if (error && !/last_sync_(error|attempt)/.test(error.message)) {
    console.error("[external-warehouse] sync status", error.message);
  }
}

function isZkNotFound(e: unknown): boolean {
  return e instanceof SubiektRequestError && e.status === 404;
}

/**
 * ZK zniknęło z Subiektu pod starym dok_Id (usunięte i wystawione ponownie, scalone itp.).
 * Szukamy dokumentu o tym samym numerze — gdy jest dokładnie jeden i nie jest już podpięty
 * do magazynu, przełączamy link (palety i notatki przeniesie rematch po towarze).
 */
async function findReplacementZk(link: SyncableZkLink): Promise<ResolvedZkDocument | null> {
  const found = await searchZkForAdd(link.zk_number);
  if (found.kind !== "single") return null;
  const resolved = found.resolved;
  if (resolved.subiektDokId === link.subiekt_dok_id) return null;
  const supabase = createAdminClient();
  const { data: taken } = await supabase
    .from("external_warehouse_zk_links")
    .select("id")
    .eq("site_id", link.site_id)
    .eq("subiekt_dok_id", resolved.subiektDokId)
    .maybeSingle();
  return taken ? null : resolved;
}

/**
 * Palety rozbite na udziały muszą mieścić się w ilości z ZK. Po zmniejszeniu ilości
 * w Subiekcie (np. 1008 → 504) nadmiar zdejmujemy od ostatniej palety i zapisujemy w dzienniku.
 * Działa przy każdym syncu, więc naprawia też starsze rozjazdy.
 */
async function rebalanceOverAllocatedShares(input: {
  link: SyncableZkLink;
  zkNumber: string;
  snapshot: ExternalWarehousePrunedSnapshot;
  actorUserId?: string | null;
}): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("external_warehouse_line_pallet_shares")
    .select("line_key, pallet_label, qty, note")
    .eq("zk_link_id", input.link.id);
  if (error || !data?.length) return 0;

  const byKey = new Map<string, { pallet_label: string; qty: number; note: string | null }[]>();
  for (const row of data as { line_key: string; pallet_label: string; qty: number | string; note: string | null }[]) {
    const bucket = byKey.get(row.line_key) ?? [];
    bucket.push({ pallet_label: row.pallet_label, qty: Number(row.qty), note: row.note ?? null });
    byKey.set(row.line_key, bucket);
  }

  let rebalanced = 0;
  for (const line of input.snapshot.lines) {
    const shares = byKey.get(line.key);
    if (!shares) continue;
    const plan = planShareRebalance(shares, line.ob_Ilosc);
    if (!plan) continue;

    // Ten sam lock co edycja palet w UI — nie nadpisujemy równoległej zmiany użytkownika.
    const lockKey = `gadki-line-pallet:${input.link.id}:${line.key}`;
    if (!(await tryAcquireLock(lockKey, 15, "gadki-line-pallet"))) continue;
    try {
      const { error: rpcError } = await supabase.rpc("replace_external_warehouse_line_pallet_shares", {
        p_zk_link_id: input.link.id,
        p_line_key: line.key,
        p_shares: plan.keep.map((s) => ({ pallet_label: s.pallet_label, qty: s.qty, note: s.note })),
        p_updated_by: input.actorUserId ?? null,
        p_max_qty: line.ob_Ilosc,
      });
      if (rpcError) {
        console.error("[external-warehouse] rebalance", rpcError.message);
        continue;
      }
    } finally {
      await releaseLock(lockKey);
    }

    rebalanced += 1;
    const name = (line.tw_Nazwa ?? line.tw_Symbol ?? line.key).trim();
    await appendChangeLog([
      {
        siteId: input.link.site_id,
        zkLinkId: input.link.id,
        kind: "shares_rebalanced",
        summary: `${input.zkNumber}: „${name}” — w ZK ${line.ob_Ilosc} szt., ${describeShareRebalance(plan)}`,
        meta: {
          line_key: line.key,
          line_qty: line.ob_Ilosc,
          removed: plan.removed,
          reduced: plan.reduced,
          keep: plan.keep,
        },
        actorUserId: input.actorUserId,
      },
    ]);
  }
  return rebalanced;
}

function changeLogEntriesForDiff(input: {
  siteId: string;
  linkId: string;
  zkNumber: string;
  diff: ExternalWarehouseRefreshDiff;
  previous: ExternalWarehousePrunedSnapshot | null;
  next: ExternalWarehousePrunedSnapshot;
  actorUserId?: string | null;
}): {
  siteId: string;
  zkLinkId: string;
  kind: string;
  summary: string;
  meta: Record<string, unknown>;
  actorUserId?: string | null;
}[] {
  return buildZkDiffChangeLogEntries(input);
}

/**
 * Sync jednego linku ZK: debounce → lock → Subiekt → prune/hash → CAS → change_log.
 *
 * WAŻNE: sync NIGDY nie usuwa ani nie nadpisuje:
 * - external_warehouse_line_meta (paleta 1:1, notatki),
 * - external_warehouse_line_pallet_shares (rozbicie na palety).
 * Zmiana ilości w ZK zostawia udziały bez zmian (ew. badge „nadmiar” w UI).
 * Gdy Subiekt zmieni ob_Id pozycji, próbujemy 1:1 rematch meta/udziałów po towarze.
 */
export async function syncExternalWarehouseZkLink(
  link: SyncableZkLink,
  options: {
    force?: boolean;
    actorUserId?: string | null;
    nowMs?: number;
  } = {}
): Promise<SyncLinkResult> {
  const force = options.force === true;
  const nowMs = options.nowMs ?? Date.now();
  const zkNumber = link.zk_number;

  // Nieudana próba też liczy się do debounce — inaczej ZK usunięte w Subiekcie
  // odpytywałoby Subiekta przy każdym renderze strony i każdym ticku auto-syncu.
  const lastTouched = [link.last_synced_at, link.last_sync_attempt_at]
    .filter((t): t is string => Boolean(t))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  if (shouldSkipDebounce(lastTouched, force, nowMs)) {
    return {
      linkId: link.id,
      zkNumber,
      status: "debounced",
      diff: null,
      lastSyncedAt: link.last_synced_at,
    };
  }

  const lockKey = gadkiZkSyncLockKey(link.id);
  const acquired = await tryAcquireLock(
    lockKey,
    EXTERNAL_WAREHOUSE_SYNC_LOCK_TTL_SEC,
    "gadki-zk-sync"
  );
  if (!acquired) {
    return {
      linkId: link.id,
      zkNumber,
      status: "locked",
      diff: null,
      lastSyncedAt: link.last_synced_at,
    };
  }

  try {
    const availability = await getSubiektAvailability();
    if (!availability.reachable) {
      return {
        linkId: link.id,
        zkNumber,
        status: "unavailable",
        diff: null,
        error: availability.message || "Subiekt niedostępny",
        lastSyncedAt: link.last_synced_at,
      };
    }

    let pruned: ExternalWarehousePrunedSnapshot;
    let lineSummary: string | null;
    let zkNumberFresh: string;
    let clientLabel: string | null;
    let replacement: ResolvedZkDocument | null = null;
    const attemptAt = new Date(nowMs).toISOString();
    try {
      let mapped: ResolvedZkDocument;
      try {
        mapped = mapZkDocument(await getSubiektZk(link.subiekt_dok_id));
      } catch (e) {
        if (!isZkNotFound(e)) throw e;
        replacement = await findReplacementZk(link).catch(() => null);
        if (!replacement) {
          // ≤ 160 znaków — dłuższe komunikaty UI przycina.
          const message =
            "ZK usunięte z Subiektu lub wystawione pod innym numerem. Pokazano ostatni zapisany stan — podmień ZK albo je odłącz.";
          await recordSyncStatus(link.id, { error: message, at: attemptAt });
          return {
            linkId: link.id,
            zkNumber,
            status: "missing",
            diff: null,
            error: message,
            lastSyncedAt: link.last_synced_at,
          };
        }
        mapped = replacement;
      }
      pruned = pruneSubiektZkSnapshot(mapped.snapshot);
      lineSummary = mapped.lineSummary;
      zkNumberFresh = mapped.zkNumber;
      clientLabel = mapped.clientLabel;
    } catch (e) {
      const message = feedbackFromException(e).message;
      await recordSyncStatus(link.id, { error: message, at: attemptAt });
      return {
        linkId: link.id,
        zkNumber,
        status: "error",
        diff: null,
        error: message,
        lastSyncedAt: link.last_synced_at,
      };
    }

    // Status dokumentu (np. „Zrealizowane”) też jest częścią stanu — zmiana statusu zapisuje snapshot.
    const nextHash = `${hashExternalWarehouseLines(pruned.lines)}:s${pruned.dok_Status ?? ""}`;
    const syncedAt = new Date(nowMs).toISOString();
    const prevSyncedAt = link.last_synced_at;
    const dokPatch = replacement ? { subiekt_dok_id: replacement.subiektDokId } : {};

    if (!replacement && link.snapshot_hash && link.snapshot_hash === nextHash) {
      const ok = await casUpdateZkLink({
        linkId: link.id,
        prevSyncedAt,
        patch: {
          last_synced_at: syncedAt,
          updated_at: syncedAt,
          zk_number: zkNumberFresh,
          line_summary: lineSummary,
          client_label: clientLabel,
        },
      });
      let rebalanced = 0;
      if (ok) {
        await recordSyncStatus(link.id, { error: null, at: attemptAt });
        rebalanced = await rebalanceOverAllocatedShares({
          link,
          zkNumber: zkNumberFresh,
          snapshot: pruned,
          actorUserId: options.actorUserId,
        });
      }
      return {
        linkId: link.id,
        zkNumber: zkNumberFresh,
        status: ok ? "unchanged" : "cas_conflict",
        diff: null,
        lastSyncedAt: ok ? syncedAt : link.last_synced_at,
        rebalanced: rebalanced || undefined,
      };
    }

    const previous = parsePrunedSnapshot(link.last_snapshot);
    const diff = computeExternalWarehouseRefreshDiff(previous, pruned);

    const ok = await casUpdateZkLink({
      linkId: link.id,
      prevSyncedAt,
      patch: {
        ...dokPatch,
        last_snapshot: pruned,
        snapshot_hash: nextHash,
        last_synced_at: syncedAt,
        updated_at: syncedAt,
        zk_number: zkNumberFresh,
        line_summary: lineSummary,
        client_label: clientLabel,
      },
    });

    if (!ok) {
      return {
        linkId: link.id,
        zkNumber: zkNumberFresh,
        status: "cas_conflict",
        diff: null,
        lastSyncedAt: link.last_synced_at,
      };
    }
    await recordSyncStatus(link.id, { error: null, at: attemptAt });

    if (replacement) {
      await appendChangeLog([
        {
          siteId: link.site_id,
          zkLinkId: link.id,
          kind: "zk_replaced",
          summary: `${zkNumberFresh}: stary dokument zniknął z Subiektu — podpięto ZK o tym samym numerze (nowe ID ${replacement.subiektDokId}), palety przeniesiono po towarze`,
          meta: { from_dok_id: link.subiekt_dok_id, to_dok_id: replacement.subiektDokId },
          actorUserId: options.actorUserId,
        },
      ]);
    }

    // Meta / udziały palet są trwałe względem snapshotu.
    // Przy zmianie kluczy pozycji (nowe ob_Id) przenieś je 1:1 po towarze.
    if (
      previous &&
      diff.removedLineKeys.length > 0 &&
      diff.addedLineKeys.length > 0
    ) {
      try {
        const rematch = await rematchMetaAfterZkDiff({
          zkLinkId: link.id,
          previousLines: previous.lines,
          nextLines: pruned.lines,
          removedKeys: diff.removedLineKeys,
          addedKeys: diff.addedLineKeys,
        });
        if (rematch.migrated > 0) {
          await appendChangeLog([
            {
              siteId: link.site_id,
              zkLinkId: link.id,
              kind: "pallet_changed",
              summary: `${zkNumberFresh}: przeniesiono meta/palety (${rematch.migrated}) po zmianie kluczy ZK`,
              meta: {
                rematched: rematch.migrated,
                skipped: rematch.skipped,
              },
              actorUserId: options.actorUserId,
            },
          ]);
        }
      } catch (e) {
        console.error(
          "[external-warehouse] rematch",
          e instanceof Error ? e.message : e
        );
      }
    }

    const logDiff: ExternalWarehouseRefreshDiff =
      previous == null
        ? {
            // Pierwszy sync po powiązaniu — bez floodu „dodano N poz.”
            // (jest już wpis zk_linked).
            addedLineKeys: [],
            removedLineKeys: [],
            quantityChanged: [],
            productChanged: [],
          }
        : diff;

    if (hasExternalWarehouseRefreshDiff(logDiff)) {
      await appendChangeLog(
        changeLogEntriesForDiff({
          siteId: link.site_id,
          linkId: link.id,
          zkNumber: zkNumberFresh,
          diff: logDiff,
          previous,
          next: pruned,
          actorUserId: options.actorUserId,
        })
      );
    }

    // Po rematchu kluczy: palety muszą mieścić się w nowych ilościach.
    const rebalanced = await rebalanceOverAllocatedShares({
      link,
      zkNumber: zkNumberFresh,
      snapshot: pruned,
      actorUserId: options.actorUserId,
    });

    return {
      linkId: link.id,
      zkNumber: zkNumberFresh,
      status: "synced",
      diff: hasExternalWarehouseRefreshDiff(diff) ? diff : null,
      lastSyncedAt: syncedAt,
      replacedDokId: replacement?.subiektDokId,
      rebalanced: rebalanced || undefined,
    };
  } finally {
    await releaseLock(lockKey);
  }
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = { status: "fulfilled", value: await fn(items[i]!) };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }

  const n = Math.min(concurrency, Math.max(items.length, 1));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

export async function syncExternalWarehouseZkLinks(
  links: SyncableZkLink[],
  options: {
    force?: boolean;
    actorUserId?: string | null;
    concurrency?: number;
  } = {}
): Promise<SyncLinkResult[]> {
  const settled = await mapPool(
    links,
    options.concurrency ?? EXTERNAL_WAREHOUSE_SYNC_CONCURRENCY,
    (link) =>
      syncExternalWarehouseZkLink(link, {
        force: options.force,
        actorUserId: options.actorUserId,
      })
  );

  return settled.map((s, i) => {
    if (s.status === "fulfilled") return s.value;
    const link = links[i]!;
    return {
      linkId: link.id,
      zkNumber: link.zk_number,
      status: "error" as const,
      diff: null,
      error: s.reason instanceof Error ? s.reason.message : "Błąd sync",
      lastSyncedAt: link.last_synced_at,
    };
  });
}

/** Eksport do testów jednostkowych. */
export const __test = {
  shouldSkipDebounce,
  changeLogEntriesForDiff,
};
