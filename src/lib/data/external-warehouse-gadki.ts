import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import {
  GADKI_SITE_SLUG,
  MAX_EXTERNAL_WAREHOUSE_CHANGE_LOG_UI,
} from "@/lib/external-warehouse/constants";
import {
  lineDtosFromPrunedSnapshot,
  orphanLineDtosFromMeta,
  parsePrunedSnapshot,
  type ExternalWarehouseLineDto,
} from "@/lib/external-warehouse/lines";
import { collectPalletLabels } from "@/lib/external-warehouse/group-by-pallet";
import type {
  ExternalWarehouseChangeLog,
  ExternalWarehouseLineMeta,
  ExternalWarehouseLinePalletShare,
  ExternalWarehouseNote,
  ExternalWarehouseSite,
  ExternalWarehouseZkLink,
} from "@/types/database";

export type GadkiZkLinkView = {
  id: string;
  subiektDokId: number;
  zkNumber: string;
  clientLabel: string;
  label: string | null;
  lineSummary: string | null;
  lastSyncedAt: string | null;
  sortOrder: number;
  lines: ExternalWarehouseLineDto[];
  orphanLines: ExternalWarehouseLineDto[];
  palletLabels: string[];
};

export type GadkiNoteView = {
  id: string;
  body: string;
  zkLinkId: string | null;
  zkNumber: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GadkiChangeLogView = {
  id: string;
  kind: ExternalWarehouseChangeLog["kind"];
  summary: string;
  zkLinkId: string | null;
  createdAt: string;
};

export type GadkiPageData = {
  site: Pick<ExternalWarehouseSite, "id" | "slug" | "name">;
  links: GadkiZkLinkView[];
  notes: GadkiNoteView[];
  changeLog: GadkiChangeLogView[];
  /** Linki surowe (z snapshotem) — tylko do sync path, nie do props UI. */
  syncLinks: Pick<
    ExternalWarehouseZkLink,
    | "id"
    | "site_id"
    | "subiekt_dok_id"
    | "zk_number"
    | "client_label"
    | "last_snapshot"
    | "snapshot_hash"
    | "last_synced_at"
  >[];
};

export async function fetchGadkiSite(): Promise<ExternalWarehouseSite | null> {
  if (!hasSupabaseConfig()) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("external_warehouse_sites")
    .select("*")
    .eq("slug", GADKI_SITE_SLUG)
    .maybeSingle();
  if (error) {
    if (error.message?.includes("external_warehouse_sites")) return null;
    throw new Error(error.message);
  }
  return data as ExternalWarehouseSite | null;
}

export async function ensureGadkiSite(): Promise<ExternalWarehouseSite> {
  const existing = await fetchGadkiSite();
  if (existing) return existing;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("external_warehouse_sites")
    .insert({ slug: GADKI_SITE_SLUG, name: "Magazyn Gądki" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ExternalWarehouseSite;
}

export async function fetchGadkiPageData(
  siteId: string
): Promise<Omit<GadkiPageData, "syncLinks"> & { syncLinks: GadkiPageData["syncLinks"] }> {
  const supabase = createAdminClient();

  const [linksRes, notesRes, logRes] = await Promise.all([
    supabase
      .from("external_warehouse_zk_links")
      .select("*")
      .eq("site_id", siteId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("external_warehouse_notes")
      .select("*")
      .eq("site_id", siteId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("external_warehouse_change_log")
      .select("id, kind, summary, zk_link_id, created_at")
      .eq("site_id", siteId)
      .order("created_at", { ascending: false })
      .limit(MAX_EXTERNAL_WAREHOUSE_CHANGE_LOG_UI),
  ]);

  if (linksRes.error) throw new Error(linksRes.error.message);
  if (notesRes.error) throw new Error(notesRes.error.message);
  if (logRes.error) throw new Error(logRes.error.message);

  const links = (linksRes.data ?? []) as ExternalWarehouseZkLink[];
  const linkIds = links.map((l) => l.id);

  let metaRows: ExternalWarehouseLineMeta[] = [];
  let shareRows: ExternalWarehouseLinePalletShare[] = [];
  if (linkIds.length) {
    const [metaRes, shareRes] = await Promise.all([
      supabase
        .from("external_warehouse_line_meta")
        .select("*")
        .in("zk_link_id", linkIds),
      supabase
        .from("external_warehouse_line_pallet_shares")
        .select("*")
        .in("zk_link_id", linkIds),
    ]);
    if (metaRes.error) throw new Error(metaRes.error.message);
    if (shareRes.error) throw new Error(shareRes.error.message);
    metaRows = (metaRes.data ?? []) as ExternalWarehouseLineMeta[];
    shareRows = (shareRes.data ?? []).map((row) => ({
      ...(row as ExternalWarehouseLinePalletShare),
      qty: Number((row as ExternalWarehouseLinePalletShare).qty),
    }));
  }

  const metaByLink = new Map<string, ExternalWarehouseLineMeta[]>();
  for (const m of metaRows) {
    const bucket = metaByLink.get(m.zk_link_id);
    if (bucket) bucket.push(m);
    else metaByLink.set(m.zk_link_id, [m]);
  }

  const sharesByLink = new Map<string, ExternalWarehouseLinePalletShare[]>();
  for (const s of shareRows) {
    const bucket = sharesByLink.get(s.zk_link_id);
    if (bucket) bucket.push(s);
    else sharesByLink.set(s.zk_link_id, [s]);
  }

  const zkNumberById = new Map(links.map((l) => [l.id, l.zk_number]));

  const linkViews: GadkiZkLinkView[] = links.map((link) => {
    const snapshot = parsePrunedSnapshot(link.last_snapshot);
    const metas = metaByLink.get(link.id) ?? [];
    const shares = sharesByLink.get(link.id) ?? [];
    const metaByKey = new Map(
      metas.map((m) => [
        m.line_key,
        { pallet_label: m.pallet_label, note: m.note },
      ])
    );
    const sharesByKey = new Map<
      string,
      { id: string; pallet_label: string; qty: number; note: string | null }[]
    >();
    for (const s of shares) {
      const item = {
        id: s.id,
        pallet_label: s.pallet_label,
        qty: Number(s.qty),
        note: s.note ?? null,
      };
      const bucket = sharesByKey.get(s.line_key);
      if (bucket) bucket.push(item);
      else sharesByKey.set(s.line_key, [item]);
    }
    const lineDtos = lineDtosFromPrunedSnapshot(
      snapshot,
      metaByKey,
      sharesByKey
    );
    const orphans = orphanLineDtosFromMeta(
      snapshot,
      metas.map((m) => ({
        line_key: m.line_key,
        pallet_label: m.pallet_label,
        note: m.note,
      })),
      shares.map((s) => ({
        id: s.id,
        line_key: s.line_key,
        pallet_label: s.pallet_label,
        qty: Number(s.qty),
        note: s.note ?? null,
      }))
    );
    return {
      id: link.id,
      subiektDokId: link.subiekt_dok_id,
      zkNumber: link.zk_number,
      clientLabel: link.client_label,
      label: link.label,
      lineSummary: link.line_summary,
      lastSyncedAt: link.last_synced_at,
      sortOrder: link.sort_order,
      lines: lineDtos,
      orphanLines: orphans,
      palletLabels: collectPalletLabels([...lineDtos, ...orphans]),
    };
  });

  const notes = (notesRes.data ?? []) as ExternalWarehouseNote[];
  const noteViews: GadkiNoteView[] = notes.map((n) => ({
    id: n.id,
    body: n.body,
    zkLinkId: n.zk_link_id,
    zkNumber: n.zk_link_id ? zkNumberById.get(n.zk_link_id) ?? null : null,
    createdAt: n.created_at,
    updatedAt: n.updated_at,
  }));

  const changeLog: GadkiChangeLogView[] = (
    (logRes.data ?? []) as Pick<
      ExternalWarehouseChangeLog,
      "id" | "kind" | "summary" | "zk_link_id" | "created_at"
    >[]
  ).map((row) => ({
    id: row.id,
    kind: row.kind,
    summary: row.summary,
    zkLinkId: row.zk_link_id,
    createdAt: row.created_at,
  }));

  return {
    site: { id: siteId, slug: GADKI_SITE_SLUG, name: "Magazyn Gądki" },
    links: linkViews,
    notes: noteViews,
    changeLog,
    syncLinks: links.map((l) => ({
      id: l.id,
      site_id: l.site_id,
      subiekt_dok_id: l.subiekt_dok_id,
      zk_number: l.zk_number,
      client_label: l.client_label,
      last_snapshot: l.last_snapshot,
      snapshot_hash: l.snapshot_hash,
      last_synced_at: l.last_synced_at,
    })),
  };
}

export async function fetchZkLinkForSite(
  linkId: string,
  siteId: string
): Promise<ExternalWarehouseZkLink | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("external_warehouse_zk_links")
    .select("*")
    .eq("id", linkId)
    .eq("site_id", siteId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as ExternalWarehouseZkLink | null;
}

export async function countZkLinksForSite(siteId: string): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("external_warehouse_zk_links")
    .select("id", { count: "exact", head: true })
    .eq("site_id", siteId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}
