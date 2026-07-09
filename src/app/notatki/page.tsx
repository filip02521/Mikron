import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import {
  canAccessOperationsNotepad,
  defaultDepartmentForRole,
  departmentsForRole,
  parseOperationsDepartment,
} from "@/lib/operations/notepad-department";
import { fetchOperationsNotepad, countOperationsNotepadBadgePerDepartment } from "@/lib/data/operations-notepad";
import { OperationsNotepadClient } from "@/components/operations-notepad/OperationsNotepadClient";
import { Alert } from "@/components/ui/Alert";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("notatki");

export default async function OperationsNotatkiPage({
  searchParams,
}: {
  searchParams: Promise<{ dzial?: string }>;
}) {
  const user = await getSessionUser();
  if (!user?.id || !user.role || !canAccessOperationsNotepad(user.role, user.assignedWorkspaces)) {
    redirect("/login");
  }

  const { dzial } = await searchParams;
  const parsed = parseOperationsDepartment(dzial, user.role, user.assignedWorkspaces);
  const department = parsed ?? defaultDepartmentForRole(user.role, user.assignedWorkspaces);

  if (!department) {
    return <Alert tone="error">Brak dostępu do notatek.</Alert>;
  }

  const normalizedDzial = dzial?.trim().toLowerCase();
  if (
    (normalizedDzial === "zakupy" || normalizedDzial === "magazyn") &&
    parsed === null
  ) {
    redirect(`/notatki?dzial=${department}`);
  }

  if (!dzial?.trim()) {
    redirect(`/notatki?dzial=${department}`);
  }

  let loadError: string | null = null;
  let initial = { privateNotes: [], publicNotes: [], archivedNotes: [] } as Awaited<
    ReturnType<typeof fetchOperationsNotepad>
  >;
  let deptBadges: Record<string, number> = {};

  try {
    initial = await fetchOperationsNotepad(department, user.id);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Nie udało się załadować notatek.";
  }

  try {
    deptBadges = await countOperationsNotepadBadgePerDepartment(
      user.id,
      departmentsForRole(user.role, user.assignedWorkspaces)
    );
  } catch {
    /* badge opcjonalny */
  }

  return (
    <OperationsNotepadClient
      key={department}
      initial={initial}
      department={department}
      userId={user.id}
      role={user.role}
      assignedWorkspaces={user.assignedWorkspaces}
      loadError={loadError}
      deptBadges={deptBadges}
    />
  );
}
