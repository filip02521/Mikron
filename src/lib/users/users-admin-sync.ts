import type { AppUserRow } from "@/lib/data/users";
import { roleRequiresSalesPerson } from "@/lib/users/labels";
import type { UserRole } from "@/types/database";

export type UserPermissionEdit = { role: UserRole; salesPersonId: string };

/** Sygnatura listy kont — stabilna przy tym samym stanie z serwera. */
export function usersAdminListSignature(users: AppUserRow[]): string {
  return users
    .map(
      (u) =>
        `${u.id}:${u.role}:${u.salesPersonId ?? ""}:${u.email}:${u.salesPersonName ?? ""}`
    )
    .join("|");
}

export function usersManagerGroupsSignature(groups: Record<string, string[]>): string {
  return Object.keys(groups)
    .sort()
    .map((id) => `${id}:${(groups[id] ?? []).slice().sort().join(",")}`)
    .join("|");
}

export function buildUserEditsFromRows(
  users: AppUserRow[]
): Record<string, UserPermissionEdit> {
  return Object.fromEntries(
    users.map((u) => [u.id, { role: u.role, salesPersonId: u.salesPersonId ?? "" }])
  );
}

function normalizedSalesPersonId(
  role: UserRole,
  salesPersonId: string
): string | null {
  if (!roleRequiresSalesPerson(role)) return null;
  const id = salesPersonId.trim();
  return id || null;
}

/** Czy wiersz ma niezapisane zmiany roli, handlowca lub grup kierownika. */
export function userRowHasUnsavedChanges(
  user: AppUserRow,
  edit: UserPermissionEdit | undefined,
  managerGroupsDraft: string[],
  managerGroupsSaved: string[]
): boolean {
  if (!edit) return false;

  if (edit.role !== user.role) return true;

  const draftSales = normalizedSalesPersonId(edit.role, edit.salesPersonId);
  const savedSales = user.salesPersonId;
  if (draftSales !== savedSales) return true;

  if (edit.role === "sales_manager") {
    const draftSig = usersManagerGroupsSignature({ [user.id]: managerGroupsDraft });
    const savedSig = usersManagerGroupsSignature({ [user.id]: managerGroupsSaved });
    if (draftSig !== savedSig) return true;
  }

  return false;
}

export function salesPersonIdForSave(
  role: UserRole,
  salesPersonId: string
): string | null {
  return normalizedSalesPersonId(role, salesPersonId);
}

export function applyUserPermissionSave(
  users: AppUserRow[],
  userId: string,
  role: UserRole,
  salesPersonId: string | null,
  salesPersonName: string | null
): AppUserRow[] {
  return users.map((row) =>
    row.id === userId
      ? {
          ...row,
          role,
          salesPersonId,
          salesPersonName: salesPersonName ?? row.salesPersonName,
        }
      : row
  );
}
