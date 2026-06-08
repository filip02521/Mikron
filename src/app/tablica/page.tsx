import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { isSalesAccount } from "@/lib/auth-roles";
import { DepartmentBoardClient } from "@/components/department-board/DepartmentBoardClient";
import {
  fetchDepartmentBoard,
  fetchSalesBoardAttentionSnapshot,
} from "@/lib/data/department-board";
import { SalesAccountLinkRequired } from "@/components/sales/SalesAccountLinkRequired";
import { DEPARTMENT_BOARD_SALES_PAGE_DESC, DEPARTMENT_BOARD_SALES_PAGE_TITLE } from "@/lib/department-board/copy";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("tablica");

export default async function SalesBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ widok?: string; watek?: string }>;
}) {
  const { widok, watek } = await searchParams;
  const user = await getSessionUser();
  if (!user?.role || !isSalesAccount(user.role)) {
    redirect("/login");
  }

  const salesPerson = await resolveSalesPersonForUser(user);
  if (!salesPerson?.id) {
    return (
      <SalesAccountLinkRequired
        title={DEPARTMENT_BOARD_SALES_PAGE_TITLE}
        description={DEPARTMENT_BOARD_SALES_PAGE_DESC}
      />
    );
  }

  let loadError: string | null = null;
  let board = { announcements: [], questions: [], readAnnouncementIds: [] } as Awaited<
    ReturnType<typeof fetchDepartmentBoard>
  >;
  let unseenQuestionIds: string[] = [];
  let initialTab: "announcements" | "questions" | undefined;
  if (widok === "pytania") initialTab = "questions";
  if (widok === "ogloszenia") initialTab = "announcements";

  try {
    const [boardData, attention] = await Promise.all([
      fetchDepartmentBoard(user.id),
      fetchSalesBoardAttentionSnapshot(user.id),
    ]);
    board = boardData;
    unseenQuestionIds = attention.unseenQuestionIds;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Nie udało się załadować tablicy.";
  }

  return (
    <DepartmentBoardClient
      initial={board}
      audience="sales"
      loadError={loadError}
      unseenQuestionIds={unseenQuestionIds}
      initialTab={initialTab}
      focusQuestionId={watek?.trim() || null}
    />
  );
}
