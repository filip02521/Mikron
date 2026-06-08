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
}: {
  initial: DepartmentBoardData;
  audience: "sales" | "procurement";
  loadError?: string | null;
  unseenQuestionIds?: string[];
  initialTab?: "announcements" | "questions";
  focusQuestionId?: string | null;
}) {
  if (audience === "sales") {
    return (
      <DepartmentBoardSalesClient
        initial={initial}
        loadError={loadError}
        unseenQuestionIds={unseenQuestionIds}
        initialTab={initialTab}
        focusQuestionId={focusQuestionId}
      />
    );
  }
  return <DepartmentBoardProcurementClient initial={initial} loadError={loadError} />;
}
