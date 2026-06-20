import { redirect } from "next/navigation";
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
  fetchDepartmentBoard,
  fetchSalesBoardAttentionSnapshot,
} from "@/lib/data/department-board";
import { SalesAccountLinkRequired } from "@/components/sales/SalesAccountLinkRequired";
import { SalesPreviewPageChrome } from "@/components/sales/SalesPreviewPageChrome";
import {
  DEPARTMENT_BOARD_SALES_PAGE_DESC,
  DEPARTMENT_BOARD_SALES_PAGE_TITLE,
} from "@/lib/department-board/copy";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("tablica");

export default async function SalesBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ widok?: string; watek?: string; dla?: string }>;
}) {
  const { widok, watek, dla: previewSalesPersonId } = await searchParams;
  const focusThreadId = watek?.trim() || null;
  const focusQuestionId = widok === "ogloszenia" ? null : focusThreadId;
  const focusAnnouncementId = widok === "ogloszenia" ? focusThreadId : null;
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
    boardProfileId = user.id;
  }

  let loadError: string | null = null;
  let board = { announcements: [], questions: [], readAnnouncementIds: [] } as Awaited<
    ReturnType<typeof fetchDepartmentBoard>
  >;
  let unseenQuestionIds: string[] = [];
  let boardAttention = null;
  let initialTab: "announcements" | "questions" | undefined;
  if (widok === "pytania") initialTab = "questions";
  if (widok === "ogloszenia") initialTab = "announcements";

  try {
    const [boardData, attention] = await Promise.all([
      fetchDepartmentBoard(boardProfileId),
      boardProfileId
        ? fetchSalesBoardAttentionSnapshot(boardProfileId).catch(() => null)
        : Promise.resolve(null),
    ]);
    board = boardData;
    unseenQuestionIds = attention?.unseenQuestionIds ?? [];
    boardAttention = attention;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Nie udało się załadować tablicy.";
  }

  const pageTitle =
    isTeamPreview && salesPersonName
      ? `Tablica: ${salesPersonName}`
      : DEPARTMENT_BOARD_SALES_PAGE_TITLE;

  const boardClient = (
    <DepartmentBoardClient
      initial={board}
      audience="sales"
      loadError={loadError}
      unseenQuestionIds={unseenQuestionIds}
      boardAttention={boardAttention}
      initialTab={initialTab}
      focusQuestionId={focusQuestionId}
      focusAnnouncementId={focusAnnouncementId}
      readOnly={readOnlyPreview}
      pageTitle={pageTitle}
      previewHint={
        previewProfileMissing
          ? "Handlowiec nie ma powiązanego konta — pokazujemy ogólną tablicę bez jego stanu odczytów."
          : readOnlyPreview
            ? "Podgląd — wysyłanie pytań i oznaczanie odczytów są wyłączone."
            : undefined
      }
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
      {boardClient}
    </SalesPreviewPageChrome>
  );
}
