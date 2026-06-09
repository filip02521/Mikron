"use client";

import type { DepartmentBoardData } from "@/lib/data/department-board";
import { DepartmentBoardSalesClient } from "@/components/department-board/DepartmentBoardSalesClient";
import { DepartmentBoardProcurementClient } from "@/components/department-board/DepartmentBoardProcurementClient";

export function DepartmentBoardClient({
  initial,
  audience,
  loadError = null,
  unseenQuestionIds = [],
  initialTab,
  focusQuestionId = null,
  focusAnnouncementId = null,
  readOnly = false,
}: {
  initial: DepartmentBoardData;
  audience: "sales" | "procurement";
  loadError?: string | null;
  unseenQuestionIds?: string[];
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
        initialTab={initialTab}
        focusQuestionId={focusQuestionId}
        focusAnnouncementId={focusAnnouncementId}
        readOnly={readOnly}
      />
    );
  }
  return <DepartmentBoardProcurementClient initial={initial} loadError={loadError} />;
}
