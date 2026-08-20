import { getSessionUser, SESSION_REQUIRED_ERROR } from "@/lib/auth";
import { isAdmin } from "@/lib/auth-roles";
import { hasMailCenterModuleForUserId } from "@/lib/admin-modules";
import { assertAdminNotInReadOnlyPanelPreview } from "@/lib/auth/guard-admin-panel-preview";
import type { SessionUser } from "@/lib/auth";

function missingPermissionError(): Error {
  return new Error("Brak uprawnień do Centrum maili");
}

export async function requireMailCenterAccess(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error(SESSION_REQUIRED_ERROR);

  if (isAdmin(user.role)) return user;

  const ok = await hasMailCenterModuleForUserId(user.id);
  if (!ok) throw missingPermissionError();
  return user;
}

export async function requireMailCenterForMutation(): Promise<SessionUser> {
  const user = await requireMailCenterAccess();
  await assertAdminNotInReadOnlyPanelPreview(user);
  return user;
}

