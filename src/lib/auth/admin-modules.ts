import { getSessionUser, SESSION_REQUIRED_ERROR } from "@/lib/auth";
import { isAdmin } from "@/lib/auth-roles";
import { hasMailCenterModuleForUserId } from "@/lib/admin-modules";
import type { SessionUser } from "@/lib/auth";

function missingPermissionError(): Error {
  return new Error("Brak uprawnień do Centrum maili");
}

export const MAIL_CENTER_MUTATIONS_DISABLED_MESSAGE =
  "Wysyłka i edycja Centrum maili Ivoclar są wyłączone w OnTime. Użyj OnTime Raporty.";

export async function requireMailCenterAccess(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error(SESSION_REQUIRED_ERROR);

  if (isAdmin(user.role)) return user;

  const ok = await hasMailCenterModuleForUserId(user.id);
  if (!ok) throw missingPermissionError();
  return user;
}

/**
 * Mutacje (send / test / preview / enable / odbiorcy) — zawsze zablokowane.
 * Wysyłkę prowadzi OnTime Raporty; OnTime = odczyt statusu.
 */
export async function requireMailCenterForMutation(): Promise<SessionUser> {
  await requireMailCenterAccess();
  const err = new Error(MAIL_CENTER_MUTATIONS_DISABLED_MESSAGE) as Error & {
    status?: number;
  };
  err.status = 403;
  throw err;
}
