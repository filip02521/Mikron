import { fetchSalesNotepad } from "@/lib/data/sales-notepad";
import { getSessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { resolvePreviewSalesPerson } from "@/lib/auth/resolve-preview-sales-person";
import { getAppRole } from "@/lib/auth-dev";
import { isAdmin, isSalesAccount, isSalesManager } from "@/lib/auth-roles";
import { SalesAccountLinkRequired } from "@/components/sales/SalesAccountLinkRequired";
import { NotatnikClient } from "@/components/notatnik/NotatnikClient";
import { getSubiektAvailability } from "@/lib/subiekt/availability";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("notatnik");

export default async function NotatnikPage({
  searchParams,
}: {
  searchParams: Promise<{ dla?: string }>;
}) {
  const { dla: previewSalesPersonId } = await searchParams;
  const role = await getAppRole();
  let salesPersonId: string | null = null;
  let salesPersonName: string | null = null;
  let ownSalesPersonId: string | null = null;
  let linkError: string | null = null;
  let isTeamPreview = false;

  try {
    const user = await getSessionUser();
    if (user && isAdmin(user.role) && previewSalesPersonId) {
      const preview = await resolvePreviewSalesPerson(previewSalesPersonId, user);
      if (preview) {
        salesPersonId = preview.id;
        salesPersonName = preview.name;
        isTeamPreview = true;
      } else {
        linkError = "Nie znaleziono handlowca do podglądu.";
      }
    } else if (user && isSalesAccount(user.role)) {
      const own = await resolveSalesPersonForUser(user);
      ownSalesPersonId = own?.id ?? null;
      if (isSalesManager(user.role) && previewSalesPersonId) {
        const preview = await resolvePreviewSalesPerson(previewSalesPersonId, user);
        if (preview) {
          salesPersonId = preview.id;
          salesPersonName = preview.name;
          isTeamPreview = preview.id !== ownSalesPersonId;
        } else {
          linkError = "Nie znaleziono handlowca do podglądu.";
        }
      } else {
        salesPersonId = own?.id ?? null;
        salesPersonName = own?.name ?? null;
        if (
          user.role === "sales" &&
          previewSalesPersonId &&
          previewSalesPersonId !== ownSalesPersonId
        ) {
          linkError = "Możesz przeglądać tylko własny notatnik — parametr ?dla= został zignorowany.";
        }
      }
      if (!ownSalesPersonId && user.role === "sales") {
        linkError =
          "Twoje konto nie jest przypisane do profilu handlowca. Poproś administratora o link zaproszenia (Admin → Handlowcy).";
      }
      if (!ownSalesPersonId && user.role === "sales_manager") {
        linkError =
          "Twoje konto kierownika nie jest przypisane do profilu handlowca — poproś administratora o przypisanie w sekcji Użytkownicy.";
      }
    }
  } catch {
    /* dev */
  }

  if (role && isSalesAccount(role) && linkError && !previewSalesPersonId) {
    return (
      <SalesAccountLinkRequired
        title="Notatnik"
        description="Twoje notatki i zamówienia klienta (ZK) czekające na towar. Konto musi być przypisane do profilu handlowca."
      />
    );
  }

  let loadError: string | null = null;
  let notepad = {
    zkWatches: [],
    archivedZkWatches: [],
    notes: [],
    archivedNotes: [],
    zkLinkableOrders: [],
  } as Awaited<ReturnType<typeof fetchSalesNotepad>>;

  if (salesPersonId) {
    try {
      notepad = await fetchSalesNotepad(salesPersonId);
    } catch (e) {
      loadError = e instanceof Error ? e.message : "Nie udało się załadować notatnika.";
    }
  }

  const subiektAvailability = await getSubiektAvailability();

  return (
    <NotatnikClient
      initial={notepad}
      readOnly={!!isTeamPreview}
      subiektAvailability={subiektAvailability}
      pageTitle={isTeamPreview ? `Notatnik: ${salesPersonName}` : "Notatnik"}
      pageDescription={
        isTeamPreview
          ? "Podgląd notatek i ZK wybranego handlowca. Edycja tylko we własnym notatniku."
          : "Wpisz numer zamówienia klienta (ZK) — dane wczytają się automatycznie. Notatki i archiwum w jednym miejscu."
      }
      linkError={linkError && (previewSalesPersonId || role === "sales") ? linkError : null}
      loadError={loadError}
      teamPreview={
        isTeamPreview && salesPersonId && salesPersonName
          ? {
              salesPersonId,
              salesPersonName,
              readOnly: role === "admin",
            }
          : null
      }
    />
  );
}
