import { createAdminClient } from "@/lib/supabase/admin";
import {
  planLineKeyRematches,
  type LineRematchCandidate,
} from "@/lib/external-warehouse/rematch-line-keys";

/**
 * Przenosi meta + udziały palet ze starych line_key na nowe (1:1).
 * Meta najpierw, potem shares — przy błędzie meta nie ruszamy udziałów.
 * Nie kasuje nic, gdy cel już ma dane — wtedy zostawia źródło jako orphan.
 */
export async function applyLineKeyRematches(
  zkLinkId: string,
  rematches: { fromKey: string; toKey: string }[]
): Promise<{ migrated: number; skipped: number }> {
  if (!rematches.length) return { migrated: 0, skipped: 0 };
  const supabase = createAdminClient();
  let migrated = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  for (const { fromKey, toKey } of rematches) {
    const [{ data: targetShares }, { data: targetMeta }] = await Promise.all([
      supabase
        .from("external_warehouse_line_pallet_shares")
        .select("id")
        .eq("zk_link_id", zkLinkId)
        .eq("line_key", toKey)
        .limit(1),
      supabase
        .from("external_warehouse_line_meta")
        .select("id, pallet_label, note")
        .eq("zk_link_id", zkLinkId)
        .eq("line_key", toKey)
        .maybeSingle(),
    ]);

    const targetHasShares = Boolean(targetShares?.length);
    const targetHasPalletOrNote = Boolean(
      targetMeta?.pallet_label || targetMeta?.note
    );
    if (targetHasShares || targetHasPalletOrNote) {
      skipped += 1;
      continue;
    }

    const [{ data: sourceShares }, { data: sourceMeta }] = await Promise.all([
      supabase
        .from("external_warehouse_line_pallet_shares")
        .select("id")
        .eq("zk_link_id", zkLinkId)
        .eq("line_key", fromKey)
        .limit(1),
      supabase
        .from("external_warehouse_line_meta")
        .select("id, pallet_label, note, updated_by")
        .eq("zk_link_id", zkLinkId)
        .eq("line_key", fromKey)
        .maybeSingle(),
    ]);

    if (!sourceShares?.length && !sourceMeta) {
      skipped += 1;
      continue;
    }

    if (sourceMeta) {
      if (targetMeta?.id) {
        const { error: copyErr } = await supabase
          .from("external_warehouse_line_meta")
          .update({
            pallet_label: sourceMeta.pallet_label,
            note: sourceMeta.note,
            updated_by: sourceMeta.updated_by,
            updated_at: now,
          })
          .eq("id", targetMeta.id);
        if (copyErr) {
          console.error("[external-warehouse] rematch meta copy", copyErr.message);
          skipped += 1;
          continue;
        }
        const { error: delMetaErr } = await supabase
          .from("external_warehouse_line_meta")
          .delete()
          .eq("id", sourceMeta.id);
        if (delMetaErr) {
          console.error(
            "[external-warehouse] rematch meta delete",
            delMetaErr.message
          );
          skipped += 1;
          continue;
        }
      } else {
        const { error: metaErr } = await supabase
          .from("external_warehouse_line_meta")
          .update({ line_key: toKey, updated_at: now })
          .eq("id", sourceMeta.id);
        if (metaErr) {
          console.error("[external-warehouse] rematch meta", metaErr.message);
          skipped += 1;
          continue;
        }
      }
    }

    if (sourceShares?.length) {
      const { error: shareErr } = await supabase
        .from("external_warehouse_line_pallet_shares")
        .update({ line_key: toKey, updated_at: now })
        .eq("zk_link_id", zkLinkId)
        .eq("line_key", fromKey);
      if (shareErr) {
        console.error("[external-warehouse] rematch shares", shareErr.message);
        skipped += 1;
        continue;
      }
    }

    migrated += 1;
  }

  return { migrated, skipped };
}

export async function rematchMetaAfterZkDiff(input: {
  zkLinkId: string;
  previousLines: LineRematchCandidate[];
  nextLines: LineRematchCandidate[];
  removedKeys: string[];
  addedKeys: string[];
}): Promise<{ migrated: number; skipped: number }> {
  if (!input.removedKeys.length || !input.addedKeys.length) {
    return { migrated: 0, skipped: 0 };
  }
  const removedSet = new Set(input.removedKeys);
  const addedSet = new Set(input.addedKeys);
  const rematches = planLineKeyRematches(
    input.previousLines.filter((l) => removedSet.has(l.key)),
    input.nextLines.filter((l) => addedSet.has(l.key))
  );
  return applyLineKeyRematches(input.zkLinkId, rematches);
}
