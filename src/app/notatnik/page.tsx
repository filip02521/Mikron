import { redirect } from "next/navigation";
import { fetchSalesNotesPageData } from "@/lib/data/sales-notepad";
import { isSalesAccount } from "@/lib/auth-roles";
import { SalesAccountLinkRequired } from "@/components/sales/SalesAccountLinkRequired";
import { NotatnikClient } from "@/components/notatnik/NotatnikClient";
import { getSubiektAvailability } from "@/lib/subiekt/availability";
import { isInvalidNotatnikTabParam, parseNotatnikPageTab } from "@/lib/sales/notepad-page-tabs";
import {
  buildNotatnikRouteRedirectUrl,
  buildZkRouteRedirectUrl,
  resolveSalesNotepadPageAccess,
  shouldRedirectNotatnikRouteToZk,
} from "@/lib/sales/notepad-page-server";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("notatnik");

type NotatnikSearchParams = {
  dla?: string;
  focusWatch?: string;
  tab?: string;
};

export default async function NotatnikPage({
  searchParams,
}: {
  searchParams: Promise<NotatnikSearchParams>;
}) {
  const params = await searchParams;
  const { dla: previewSalesPersonId, focusWatch, tab } = params;

  if (shouldRedirectNotatnikRouteToZk({ tab, focusWatch })) {
    redirect(
      buildZkRouteRedirectUrl({
        searchParams: params,
        focusWatch,
      })
    );
  }

  if (isInvalidNotatnikTabParam(tab)) {
    redirect(
      buildNotatnikRouteRedirectUrl({
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
        title="Notatnik"
        hint="Twoje prywatne przypomnienia i notatki. Konto musi być przypisane do profilu handlowca."
      />
    );
  }

  let loadError: string | null = null;
  let notesData = {
    notes: [],
    archivedNotes: [],
  } as Awaited<ReturnType<typeof fetchSalesNotesPageData>>;

  if (access.salesPersonId) {
    try {
      notesData = await fetchSalesNotesPageData(access.salesPersonId);
    } catch (e) {
      loadError = e instanceof Error ? e.message : "Nie udało się załadować notatnika.";
    }
  }

  const subiektAvailability = await getSubiektAvailability();
  const initialTab = parseNotatnikPageTab(tab) ?? "notes";

  return (
    <NotatnikClient
      surface="notes"
      initial={{
        zkWatches: [],
        archivedZkWatches: [],
        zkLinkableOrders: [],
        ...notesData,
      }}
      initialFocusWatchId={focusWatch?.trim() || null}
      initialTab={initialTab}
      readOnly={!!access.isTeamPreview}
      subiektAvailability={subiektAvailability}
      pageTitle={access.isTeamPreview ? `Notatnik: ${access.salesPersonName}` : "Notatnik"}
      pageDescription={
        access.isTeamPreview
          ? "Podgląd notatek i archiwum wybranego handlowca. Edycja tylko we własnym Notatniku."
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
