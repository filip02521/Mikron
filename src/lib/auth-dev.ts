import { getSessionUser } from "@/lib/auth";
import { needsBootstrapSetup } from "@/lib/setup/bootstrap";
import type { UserRole } from "@/types/database";

/** Rola zalogowanego użytkownika (zawsze z bazy, bez trybu dev-admin). */
export async function getAppRole(): Promise<UserRole | null> {
  if (await needsBootstrapSetup()) {
    return null;
  }

  try {
    const user = await getSessionUser();
    return user?.role ?? null;
  } catch {
    return null;
  }
}
