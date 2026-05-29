import { fetchSalesNotepad } from "@/lib/data/sales-notepad";
import { getSessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { resolvePreviewSalesPerson } from "@/lib/auth/resolve-preview-sales-person";
import { getAppRole } from "@/lib/auth-dev";
import { isSalesAccount, isSalesManager } from "@/lib/auth-roles";
import { Alert } from "@/components/ui/Alert";
import { SalesAccountLinkRequired } from "@/components/sales/SalesAccountLinkRequired";
import { ManagerPreviewBanner } from "@/components/sales/ManagerPreviewBanner";
import { NotatnikClient } from "@/components/notatnik/NotatnikClient";
import { getSubiektAvailability } from "@/lib/subiekt/availability";

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
    if (user && isSalesAccount(user.role)) {
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
      }
      if (!ownSalesPersonId && user.role === "sales") {
        linkError =
          "Twoje konto nie jest powiązane z kartą handlowca. Poproś administratora o nowy link zaproszenia (Admin → Handlowcy).";
      }
      if (!ownSalesPersonId && user.role === "sales_manager") {
        linkError =
          "Twoje konto kierownika nie jest powiązane z kartą handlowca — poproś administratora o przypisanie w panelu użytkowników.";
      }
    }
  } catch {
    /* dev */
  }

  if (role && isSalesAccount(role) && linkError && !previewSalesPersonId) {
    return (
      <SalesAccountLinkRequired
        title="Notatnik"
        description="Twoje notatki i ZK oczekujące na zapłatę — wymagane powiązanie konta z kartą handlowca."
      />
    );
  }

  let loadError: string | null = null;
  let notepad = {
    paymentWatches: [],
    archivedPaymentWatches: [],
    notes: [],
    archivedNotes: [],
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
    <div className="mx-auto max-w-3xl space-y-4">
      {linkError && previewSalesPersonId ? <Alert tone="error">{linkError}</Alert> : null}

      {isTeamPreview && salesPersonId && salesPersonName ? (
        <ManagerPreviewBanner
          salesPersonId={salesPersonId}
          salesPersonName={salesPersonName}
          notatnikPreview
        />
      ) : null}

      {loadError ? <Alert tone="error">{loadError}</Alert> : null}

      <NotatnikClient
        initial={notepad}
        readOnly={!!isTeamPreview}
        subiektAvailability={subiektAvailability}
        pageTitle={isTeamPreview ? `Notatnik: ${salesPersonName}` : "Notatnik"}
        pageDescription={
          isTeamPreview
            ? "Podgląd notatek i ZK handlowca — edycja tylko na własnym koncie."
            : "Wpisz numer ZK — reszta wczyta się z Subiekta. Notatki i archiwum w jednym miejscu."
        }
      />
    </div>
  );
}
