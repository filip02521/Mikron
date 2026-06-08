import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canAccessOperations } from "@/lib/auth-roles";
import { DepartmentBoardClient } from "@/components/department-board/DepartmentBoardClient";
import { fetchDepartmentBoard } from "@/lib/data/department-board";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("procurementBoard");

export default async function ProcurementBoardPage() {
  const user = await getSessionUser();
  if (!user?.role || !canAccessOperations(user.role)) {
    redirect("/login");
  }

  let loadError: string | null = null;
  let board = { announcements: [], questions: [], readAnnouncementIds: [] } as Awaited<
    ReturnType<typeof fetchDepartmentBoard>
  >;

  try {
    board = await fetchDepartmentBoard(user.id);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Nie udało się załadować tablicy.";
  }

  return <DepartmentBoardClient initial={board} audience="procurement" loadError={loadError} />;
}
