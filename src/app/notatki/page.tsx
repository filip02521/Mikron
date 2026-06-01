import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import {
  canAccessOperationsNotepad,
  defaultDepartmentForRole,
  parseOperationsDepartment,
} from "@/lib/operations/notepad-department";
import { fetchOperationsNotepad } from "@/lib/data/operations-notepad";
import { OperationsNotepadClient } from "@/components/operations-notepad/OperationsNotepadClient";
import { Alert } from "@/components/ui/Alert";

export default async function OperationsNotatkiPage({
  searchParams,
}: {
  searchParams: Promise<{ dzial?: string }>;
}) {
  const user = await getSessionUser();
  if (!user?.id || !user.role || !canAccessOperationsNotepad(user.role)) {
    redirect("/login");
  }

  const { dzial } = await searchParams;
  const parsed = parseOperationsDepartment(dzial, user.role);
  const department = parsed ?? defaultDepartmentForRole(user.role);

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

  try {
    initial = await fetchOperationsNotepad(department, user.id);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Nie udało się załadować notatek.";
  }

  return (
    <>
      {loadError ? <Alert tone="error">{loadError}</Alert> : null}
      <OperationsNotepadClient
        key={department}
        initial={initial}
        department={department}
        userId={user.id}
        role={user.role}
      />
    </>
  );
}
