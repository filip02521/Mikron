import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canAccessOperations } from "@/lib/auth-roles";
import { DepartmentBoardClient } from "@/components/department-board/DepartmentBoardClient";
import { fetchDepartmentBoard } from "@/lib/data/department-board";

import type { Metadata } from "next";
import { Suspense } from "react";
import { pageMetadataFor } from "@/lib/ui/page-metadata";
import ProcurementTablicaLoading from "./loading";

export const metadata: Metadata = pageMetadataFor("procurementBoard");

export const dynamic = "force-dynamic";

export default async function ProcurementBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ widok?: string; watek?: string }>;
}) {
  const { widok, watek } = await searchParams;
  const focusThreadId = watek?.trim() || null;
  const user = await getSessionUser();
  if (!user?.role || !canAccessOperations(user.role, user.assignedWorkspaces)) {
    redirect("/login");
  }

  let loadError: string | null = null;
  let board = { announcements: [], questions: [], closedQuestions: [], readAnnouncementIds: [] } as Awaited<
    ReturnType<typeof fetchDepartmentBoard>
  >;

  try {
    board = await fetchDepartmentBoard(user.id);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Nie udało się załadować tablicy.";
  }

  let initialTab: "announcements" | "questions" | undefined;
  if (widok === "pytania") initialTab = "questions";
  if (widok === "ogloszenia") initialTab = "announcements";

  let focusQuestionId = widok === "pytania" ? focusThreadId : null;
  let focusAnnouncementId = widok === "ogloszenia" ? focusThreadId : null;

  if (focusThreadId && !widok) {
    if (board.questions.some((question) => question.id === focusThreadId)) {
      focusQuestionId = focusThreadId;
      initialTab = "questions";
    } else if (board.announcements.some((announcement) => announcement.id === focusThreadId)) {
      focusAnnouncementId = focusThreadId;
      initialTab = "announcements";
    }
  }

  return (
    <Suspense fallback={<ProcurementTablicaLoading />}>
      <DepartmentBoardClient
        initial={board}
        audience="procurement"
        loadError={loadError}
        initialTab={initialTab}
        focusQuestionId={focusQuestionId}
        focusAnnouncementId={focusAnnouncementId}
      />
    </Suspense>
  );
}
