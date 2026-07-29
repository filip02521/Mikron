import { getSubiektZk } from "@/lib/subiekt/api";
import { mapZkDocument } from "@/lib/subiekt/resolve-zk-document";
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
    | "error";
  diff: ExternalWarehouseRefreshDiff | null;
  error?: string;
  lastSyncedAt?: string | null;
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
>;

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
  if (error) {
    console.error("[external-warehouse] change_log", error.message);
  }
}

function changeLogEntriesForDiff(input: {
  siteId: string;
  linkId: string;
  zkNumber: string;
  diff: ExternalWarehouseRefreshDiff;
  actorUserId?: string | null;
}): {
  siteId: string;
  zkLinkId: string;
  kind: string;
  summary: string;
  meta: Record<string, unknown>;
  actorUserId?: string | null;
}[] {
  const out: {
    siteId: string;
    zkLinkId: string;
    kind: string;
    summary: string;
    meta: Record<string, unknown>;
    actorUserId?: string | null;
  }[] = [];

  if (input.diff.addedLineKeys.length) {
    out.push({
      siteId: input.siteId,
      zkLinkId: input.linkId,
      kind: "lines_added",
      summary: `${input.zkNumber}: dodano ${input.diff.addedLineKeys.length} poz.`,
      meta: { keys: input.diff.addedLineKeys.slice(0, 40) },
      actorUserId: input.actorUserId,
    });
  }
  if (input.diff.removedLineKeys.length) {
    out.push({
      siteId: input.siteId,
      zkLinkId: input.linkId,
      kind: "lines_removed",
      summary: `${input.zkNumber}: usunięto ${input.diff.removedLineKeys.length} poz.`,
      meta: { keys: input.diff.removedLineKeys.slice(0, 40) },
      actorUserId: input.actorUserId,
    });
  }
  if (input.diff.quantityChanged.length) {
    out.push({
      siteId: input.siteId,
      zkLinkId: input.linkId,
      kind: "qty_changed",
      summary: `${input.zkNumber}: zmieniono ilość (${input.diff.quantityChanged.length})`,
      meta: { changes: input.diff.quantityChanged.slice(0, 40) },
      actorUserId: input.actorUserId,
    });
  }
  return out;
}

/**
 * Sync jednego linku ZK: debounce → lock → Subiekt → prune/hash → CAS → change_log.
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

  if (shouldSkipDebounce(link.last_synced_at, force, nowMs)) {
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
    let zkNumberFresh = zkNumber;
    let clientLabel = link.client_label;
    try {
      const doc = await getSubiektZk(link.subiekt_dok_id);
      const mapped = mapZkDocument(doc);
      pruned = pruneSubiektZkSnapshot(mapped.snapshot);
      lineSummary = mapped.lineSummary;
      zkNumberFresh = mapped.zkNumber;
      clientLabel = mapped.clientLabel;
    } catch (e) {
      return {
        linkId: link.id,
        zkNumber,
        status: "error",
        diff: null,
        error: feedbackFromException(e).message,
        lastSyncedAt: link.last_synced_at,
      };
    }

    const nextHash = hashExternalWarehouseLines(pruned.lines);
    const syncedAt = new Date(nowMs).toISOString();
    const prevSyncedAt = link.last_synced_at;

    if (link.snapshot_hash && link.snapshot_hash === nextHash) {
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
      return {
        linkId: link.id,
        zkNumber: zkNumberFresh,
        status: ok ? "unchanged" : "cas_conflict",
        diff: null,
        lastSyncedAt: ok ? syncedAt : link.last_synced_at,
      };
    }

    const previous = parsePrunedSnapshot(link.last_snapshot);
    const diff = computeExternalWarehouseRefreshDiff(previous, pruned);

    const ok = await casUpdateZkLink({
      linkId: link.id,
      prevSyncedAt,
      patch: {
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

    const logDiff: ExternalWarehouseRefreshDiff =
      previous == null
        ? {
            addedLineKeys: pruned.lines.map((l) => l.key),
            removedLineKeys: [],
            quantityChanged: [],
          }
        : diff;

    if (hasExternalWarehouseRefreshDiff(logDiff)) {
      await appendChangeLog(
        changeLogEntriesForDiff({
          siteId: link.site_id,
          linkId: link.id,
          zkNumber: zkNumberFresh,
          diff: logDiff,
          actorUserId: options.actorUserId,
        })
      );
    }

    return {
      linkId: link.id,
      zkNumber: zkNumberFresh,
      status: "synced",
      diff: hasExternalWarehouseRefreshDiff(diff) ? diff : null,
      lastSyncedAt: syncedAt,
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
