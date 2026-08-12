import { createAdminClient } from "@/lib/supabase/admin";
import { buildZkWatchLineViews } from "@/lib/sales/zk-watch-lines";
import {
  clearZkTeethDraftsForKeys,
  parseZkTeethDrafts,
} from "@/lib/sales/zk-watch-teeth-draft";
import { resolveZkTeethDraftKeysToClear } from "@/lib/sales/clear-zk-teeth-drafts-keys";
import type { SalesZkWatch } from "@/types/database";

/**
 * Czyści szkice zębów po złożeniu prośby.
 * Preferuje lineKeys (gdy znane); inaczej match po tw_Id draftu lub aktualnej linii ZK.
 */
export async function clearZkTeethDraftsAfterOrdersCreated(input: {
  sourceZkWatchId: string;
  teethTwIds: number[];
  lineKeys?: string[];
}): Promise<void> {
  const watchId = input.sourceZkWatchId.trim();
  if (!watchId) return;

  const supabase = createAdminClient();
  const { data: row, error } = await supabase
    .from("sales_zk_watches")
    .select("id, teeth_drafts, subiekt_snapshot, line_summary, line_checks")
    .eq("id", watchId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return;

  const drafts = parseZkTeethDrafts(row.teeth_drafts);
  const views = buildZkWatchLineViews(row as SalesZkWatch);
  const viewTwIdByKey = new Map(
    views
      .filter((v) => v.key !== "summary")
      .map((v) => [
        v.key,
        v.subiektTwId != null && Number.isFinite(Number(v.subiektTwId))
          ? Math.trunc(Number(v.subiektTwId))
          : null,
      ])
  );

  const keysToClear = resolveZkTeethDraftKeysToClear({
    teethDrafts: drafts,
    teethTwIds: input.teethTwIds,
    lineKeys: input.lineKeys,
    viewTwIdByKey,
  });
  if (!keysToClear.length) return;

  const next = clearZkTeethDraftsForKeys(drafts, keysToClear);
  const { error: updateError } = await supabase
    .from("sales_zk_watches")
    .update({
      teeth_drafts: next,
      updated_at: new Date().toISOString(),
    })
    .eq("id", watchId);
  if (updateError) throw new Error(updateError.message);
}
