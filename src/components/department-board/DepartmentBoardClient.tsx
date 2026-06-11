"use client";

import type { DepartmentBoardAttentionBanners } from "@/lib/department-board/board-attention-banners";
import type { DepartmentBoardData } from "@/lib/data/department-board";
import { DepartmentBoardSalesClient } from "@/components/department-board/DepartmentBoardSalesClient";
import { DepartmentBoardProcurementClient } from "@/components/department-board/DepartmentBoardProcurementClient";

export function DepartmentBoardClient({
  initial,
  audience,
  loadError = null,
  unseenQuestionIds = [],
  boardAttention = null,
  initialTab,
  focusQuestionId = null,
  focusAnnouncementId = null,
  readOnly = false,
}: {
  initial: DepartmentBoardData;
  audience: "sales" | "procurement";
  loadError?: string | null;
  unseenQuestionIds?: string[];
  boardAttention?: DepartmentBoardAttentionBanners | null;
  initialTab?: "announcements" | "questions";
  focusQuestionId?: string | null;
  focusAnnouncementId?: string | null;
  readOnly?: boolean;
}) {
  if (audience === "sales") {
    return (
      <DepartmentBoardSalesClient
        initial={initial}
        loadError={loadError}
        unseenQuestionIds={unseenQuestionIds}
        boardAttention={boardAttention}
        initialTab={initialTab}
        focusQuestionId={focusQuestionId}
        focusAnnouncementId={focusAnnouncementId}
        readOnly={readOnly}
      />
    );
  }
  return <DepartmentBoardProcurementClient initial={initial} loadError={loadError} />;
}
