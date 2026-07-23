"use client";

import type { DepartmentBoardAttentionBanners } from "@/lib/department-board/board-attention-banners";
import type {
  DepartmentBoardData,
  DepartmentBoardQuestionsSlice,
} from "@/lib/data/department-board";
import { DepartmentBoardSalesClient } from "@/components/department-board/DepartmentBoardSalesClient";
import { DepartmentBoardProcurementClient } from "@/components/department-board/DepartmentBoardProcurementClient";

export function DepartmentBoardClient({
  initial,
  audience,
  loadError = null,
  unseenQuestionIds = [],
  unseenOwnQuestionIds = [],
  boardAttention = null,
  initialTab,
  focusQuestionId = null,
  focusAnnouncementId = null,
  readOnly = false,
  pageTitle,
  previewHint,
  currentSalesPersonId = null,
  currentUserId = null,
}: {
  initial: DepartmentBoardData | DepartmentBoardQuestionsSlice;
  audience: "sales" | "procurement";
  loadError?: string | null;
  unseenQuestionIds?: string[];
  unseenOwnQuestionIds?: string[];
  boardAttention?: DepartmentBoardAttentionBanners | null;
  initialTab?: "announcements" | "questions";
  focusQuestionId?: string | null;
  focusAnnouncementId?: string | null;
  readOnly?: boolean;
  pageTitle?: string;
  previewHint?: string;
  currentSalesPersonId?: string | null;
  currentUserId?: string | null;
}) {
  if (audience === "sales") {
    const questionsInitial: DepartmentBoardQuestionsSlice =
      "announcements" in initial
        ? { questions: initial.questions, closedQuestions: initial.closedQuestions }
        : initial;

    return (
      <DepartmentBoardSalesClient
        initial={questionsInitial}
        loadError={loadError}
        unseenQuestionIds={unseenQuestionIds}
        unseenOwnQuestionIds={unseenOwnQuestionIds}
        boardAttention={boardAttention}
        focusQuestionId={focusQuestionId}
        readOnly={readOnly}
        pageTitle={pageTitle}
        previewHint={previewHint}
        currentSalesPersonId={currentSalesPersonId}
        currentUserId={currentUserId}
      />
    );
  }
  return (
    <DepartmentBoardProcurementClient
      initial={initial as DepartmentBoardData}
      loadError={loadError}
      initialTab={initialTab}
      focusQuestionId={focusQuestionId}
      focusAnnouncementId={focusAnnouncementId}
    />
  );
}
