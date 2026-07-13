import { redirect } from "next/navigation";
import { MOJE_ANNOUNCEMENT_FOCUS_PARAM, MOJE_ANNOUNCEMENTS_SECTION_ID } from "@/lib/department-board/moje-announcements-ui";
import { getSessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import {
  resolvePreviewSalesPerson,
  resolveProfileIdForSalesPerson,
} from "@/lib/auth/resolve-preview-sales-person";
import { isAdmin, isSalesAccount, isSalesManager } from "@/lib/auth-roles";
import { readAdminPanelContextForSession } from "@/lib/auth/read-admin-panel-context";
import { DepartmentBoardClient } from "@/components/department-board/DepartmentBoardClient";
import {
  fetchDepartmentBoardQuestions,
  fetchDepartmentBoardThreadKind,
  fetchSalesBoardAttentionSnapshot,
} from "@/lib/data/department-board";
import { Alert } from "@/components/ui/Alert";
import { SalesAccountLinkRequired } from "@/components/sales/SalesAccountLinkRequired";
import { SalesPreviewPageChrome } from "@/components/sales/SalesPreviewPageChrome";
import {
  DEPARTMENT_BOARD_SALES_PAGE_DESC,
  DEPARTMENT_BOARD_SALES_PAGE_TITLE,
} from "@/lib/department-board/copy";

import type { Metadata } from "next";
import { Suspense } from "react";
import { pageMetadataFor } from "@/lib/ui/page-metadata";
import TablicaLoading from "./loading";

export const metadata: Metadata = pageMetadataFor("tablica");
export const dynamic = "force-dynamic";

export default async function SalesBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ widok?: string; watek?: string; dla?: string }>;
}) {
  const { widok, watek, dla: previewSalesPersonId } = await searchParams;

  if (widok === "ogloszenia") {
    const params = new URLSearchParams();
    if (watek?.trim()) params.set(MOJE_ANNOUNCEMENT_FOCUS_PARAM, watek.trim());
    if (previewSalesPersonId?.trim()) params.set("dla", previewSalesPersonId.trim());
    const qs = params.toString();
    redirect(`/moje${qs ? `?${qs}` : ""}#${MOJE_ANNOUNCEMENTS_SECTION_ID}`);
  }

  const focusThreadId = watek?.trim() || null;
  const focusQuestionId = focusThreadId;
  const user = await getSessionUser();
  const { panelContext } = await readAdminPanelContextForSession();

  if (!user?.role) {
    redirect("/login");
  }

  let salesPersonId: string | null = null;
  let salesPersonName: string | null = null;
  let isTeamPreview = false;
  let readOnlyPreview = false;
  let adminReadOnlyPreview = false;
  let boardProfileId: string | null = user.id;
  let linkError: string | null = null;
  let previewProfileMissing = false;

  const adminSalesPanelPreview = Boolean(
    isAdmin(user.role) && panelContext === "sales"
  );

  if (isAdmin(user.role) && (adminSalesPanelPreview || previewSalesPersonId?.trim())) {
    readOnlyPreview = true;
    adminReadOnlyPreview = true;
    if (previewSalesPersonId?.trim()) {
      const preview = await resolvePreviewSalesPerson(previewSalesPersonId, user);
      if (preview) {
        salesPersonId = preview.id;
        salesPersonName = preview.name;
        isTeamPreview = true;
        const linkedProfileId = await resolveProfileIdForSalesPerson(preview.id);
        if (linkedProfileId) {
          boardProfileId = linkedProfileId;
        } else {
          previewProfileMissing = true;
          boardProfileId = user.id;
        }
      } else {
        linkError = "Nie znaleziono handlowca do podglądu.";
      }
    }
  } else if (isSalesManager(user.role) && previewSalesPersonId?.trim()) {
    const own = await resolveSalesPersonForUser(user);
    const preview = await resolvePreviewSalesPerson(previewSalesPersonId, user);
    if (preview) {
      salesPersonId = preview.id;
      salesPersonName = preview.name;
      isTeamPreview = preview.id !== own?.id;
      if (isTeamPreview) {
        readOnlyPreview = true;
        const linkedProfileId = await resolveProfileIdForSalesPerson(preview.id);
        if (linkedProfileId) {
          boardProfileId = linkedProfileId;
        } else {
          previewProfileMissing = true;
          boardProfileId = user.id;
        }
      } else {
        boardProfileId = user.id;
      }
    } else {
      linkError = "Nie znaleziono handlowca do podglądu.";
    }
  } else if (!isSalesAccount(user.role)) {
    redirect("/login");
  }

  if (!readOnlyPreview && !isSalesAccount(user.role)) {
    redirect("/login");
  }

  if (!readOnlyPreview) {
    const salesPerson = await resolveSalesPersonForUser(user);
    if (!salesPerson?.id) {
      return (
        <SalesAccountLinkRequired
          title={DEPARTMENT_BOARD_SALES_PAGE_TITLE}
          hint={DEPARTMENT_BOARD_SALES_PAGE_DESC}
        />
      );
    }
    salesPersonId = salesPerson.id;
    boardProfileId = user.id;
  }

  let loadError: string | null = null;
  let questions = [] as Awaited<ReturnType<typeof fetchDepartmentBoardQuestions>>["questions"];
  let unseenQuestionIds: string[] = [];
  let unseenOwnQuestionIds: string[] = [];
  let boardAttention = null;

  try {
    const [questionsData, attention] = await Promise.all([
      fetchDepartmentBoardQuestions(),
      boardProfileId
        ? fetchSalesBoardAttentionSnapshot(boardProfileId).catch(() => null)
        : Promise.resolve(null),
    ]);
    questions = questionsData.questions;
    unseenQuestionIds = attention?.unseenQuestionIds ?? [];
    unseenOwnQuestionIds = attention?.unseenOwnQuestionIds ?? [];
    boardAttention = attention;

    if (focusThreadId && !questions.some((question) => question.id === focusThreadId)) {
      const kind = await fetchDepartmentBoardThreadKind(focusThreadId);
      if (kind === "announcement") {
        const params = new URLSearchParams();
        params.set(MOJE_ANNOUNCEMENT_FOCUS_PARAM, focusThreadId);
        if (previewSalesPersonId?.trim()) params.set("dla", previewSalesPersonId.trim());
        redirect(`/moje?${params.toString()}#${MOJE_ANNOUNCEMENTS_SECTION_ID}`);
      }
    }
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Nie udało się załadować tablicy.";
  }

  const pageTitle =
    isTeamPreview && salesPersonName
      ? `Pytania zespołu: ${salesPersonName}`
      : DEPARTMENT_BOARD_SALES_PAGE_TITLE;

  const boardClient = (
    <DepartmentBoardClient
      initial={{ questions }}
      audience="sales"
      loadError={loadError}
      unseenQuestionIds={unseenQuestionIds}
      unseenOwnQuestionIds={unseenOwnQuestionIds}
      boardAttention={boardAttention}
      focusQuestionId={focusQuestionId}
      readOnly={readOnlyPreview}
      pageTitle={pageTitle}
      previewHint={
        readOnlyPreview && !previewProfileMissing
          ? "Podgląd — wysyłanie pytań i oznaczanie odczytów są wyłączone."
          : undefined
      }
      currentSalesPersonId={salesPersonId}
    />
  );

  return (
    <SalesPreviewPageChrome
      linkError={linkError}
      teamPreview={
        isTeamPreview && salesPersonId && salesPersonName
          ? {
              salesPersonId,
              salesPersonName,
              readOnly: adminReadOnlyPreview,
              scope: "tablica",
            }
          : null
      }
    >
      {previewProfileMissing ? (
        <Alert tone="warning" className="mb-4">
          Handlowiec <strong>{salesPersonName}</strong> nie ma powiązanego konta użytkownika.
          Pokazujemy ogólną tablicę działu — stan odczytów i powiadomień dotyczy Twojego konta,
          nie tego handlowca.
        </Alert>
      ) : null}
      <Suspense fallback={<TablicaLoading />}>{boardClient}</Suspense>
    </SalesPreviewPageChrome>
  );
}