import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireZdEstimateAdmin } from "@/lib/auth";
import { pageMetadataFor } from "@/lib/ui/page-metadata";
import { adminPageShellClass } from "@/lib/ui/ontime-theme";
import { getPurchaseDraft, listDraftAddableItems } from "@/lib/stock-watch/drafts";
import {
  isSubiektOrdersLiveBaseUrl,
  resolveSubiektOrdersConfig,
  zdEstimateOrdersHostLabel,
} from "@/lib/subiekt/config";
import { PurchaseDraftEditor } from "@/components/stock-watch/PurchaseDraftEditor";

export const metadata: Metadata = pageMetadataFor("stockWatch");
export const dynamic = "force-dynamic";
/** Tworzenie ZD przez Sferę — do 180 s. */
export const maxDuration = 300;

export default async function PurchaseDraftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireZdEstimateAdmin("read");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const draft = await getPurchaseDraft(id);
  if (!draft) notFound();

  let canMutate = true;
  try {
    await requireZdEstimateAdmin("mutate");
  } catch {
    canMutate = false;
  }

  const addable = draft.status === "draft" ? await listDraftAddableItems(id) : [];
  const orders = resolveSubiektOrdersConfig();
  const host = orders.ok
    ? {
        configured: true,
        isLive: isSubiektOrdersLiveBaseUrl(orders.config.baseUrl),
        label: zdEstimateOrdersHostLabel(orders.config.baseUrl),
      }
    : { configured: false, isLive: false, label: orders.message };

  return (
    <div className={adminPageShellClass}>
      <PurchaseDraftEditor draft={draft} addable={addable} canMutate={canMutate} host={host} />
    </div>
  );
}
