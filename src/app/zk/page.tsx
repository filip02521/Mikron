import { redirect } from "next/navigation";
import { fetchSalesZkPageData } from "@/lib/data/sales-notepad";
import { isSalesAccount } from "@/lib/auth-roles";
import { SalesAccountLinkRequired } from "@/components/sales/SalesAccountLinkRequired";
import { NotatnikClient } from "@/components/notatnik/NotatnikClient";
import { getSubiektAvailability } from "@/lib/subiekt/availability";
import { isInvalidNotatnikTabParam, parseNotatnikPageTab } from "@/lib/sales/notepad-page-tabs";
import {
  buildNotatnikRouteRedirectUrl,
  buildZkRouteRedirectUrl,
  resolveSalesNotepadPageAccess,
  shouldRedirectZkRouteToNotatnik,
} from "@/lib/sales/notepad-page-server";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("zk");

type ZkSearchParams = {
  dla?: string;
  focusWatch?: string;
  tab?: string;
};

export default async function ZkPage({
  searchParams,
}: {
  searchParams: Promise<ZkSearchParams>;
}) {
  const params = await searchParams;
  const { dla: previewSalesPersonId, focusWatch, tab } = params;

  if (shouldRedirectZkRouteToNotatnik(tab)) {
    redirect(
      buildNotatnikRouteRedirectUrl({
        tab,
        searchParams: params,
      })
    );
  }

  const access = await resolveSalesNotepadPageAccess({
    previewSalesPersonId,
  });

  if (access.role && isSalesAccount(access.role) && access.linkError && !access.previewSalesPersonId) {
    return (
      <SalesAccountLinkRequired
        title="ZK czekające"
        hint="Zamówienia klientów (ZK) z towarem na Subiekcie i Twoje prośby. Konto musi być przypisane do profilu handlowca."
      />
    );
  }

  let loadError: string | null = null;
  let zkData = {
    zkWatches: [],
    archivedZkWatches: [],
    zkLinkableOrders: [],
  } as Awaited<ReturnType<typeof fetchSalesZkPageData>>;

  if (access.salesPersonId) {
    try {
      zkData = await fetchSalesZkPageData(access.salesPersonId);
    } catch (e) {
      loadError = e instanceof Error ? e.message : "Nie udało się załadować listy ZK.";
    }
  }

  if (isInvalidNotatnikTabParam(tab)) {
    redirect(
      buildZkRouteRedirectUrl({
        searchParams: params,
        focusWatch,
      })
    );
  }

  const subiektAvailability = await getSubiektAvailability();
  const initialTab = parseNotatnikPageTab(tab) ?? "zk";

  return (
    <NotatnikClient
      surface="zk"
      initial={{
        ...zkData,
        notes: [],
        archivedNotes: [],
      }}
      initialFocusWatchId={focusWatch?.trim() || null}
      initialTab={initialTab}
      readOnly={!!access.isTeamPreview}
      subiektAvailability={subiektAvailability}
      pageTitle={
        access.isTeamPreview ? `ZK czekające: ${access.salesPersonName}` : "ZK czekające"
      }
      pageDescription={
        access.isTeamPreview
          ? "Podgląd ZK czekających wybranego handlowca. Edycja tylko we własnej zakładce ZK czekające."
          : undefined
      }
      linkError={
        access.linkError && (access.previewSalesPersonId || access.role === "sales")
          ? access.linkError
          : null
      }
      loadError={loadError}
      teamPreview={
        access.isTeamPreview && access.salesPersonId && access.salesPersonName
          ? {
              salesPersonId: access.salesPersonId,
              salesPersonName: access.salesPersonName,
              readOnly: access.role === "admin",
            }
          : null
      }
    />
  );
}
