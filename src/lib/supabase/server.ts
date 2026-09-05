import { cookies } from "next/headers";
import { COOKIE_NAME } from "@/lib/auth-local/cookies";
import { validateSession } from "@/lib/auth-local/session";
import { hashPassword } from "@/lib/auth-local/password";
import { findUserById, updatePassword } from "@/lib/auth-local/users";
import { createAdminClient, type DatabaseClient } from "@/lib/db/admin";

/**
 * Klient bazy + lokalna sesja z ciasteczka (zastępuje Supabase SSR).
 */
export async function createClient(): Promise<DatabaseClient> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(COOKIE_NAME)?.value;
  const session = rawToken ? await validateSession(rawToken) : null;
  const db = createAdminClient();

  return {
    ...db,
    auth: {
      ...db.auth,
      async getUser() {
        if (!session) return { data: { user: null }, error: null };
        const account = await findUserById(session.userId);
        return {
          data: { user: { id: session.userId, email: account?.email ?? null } },
          error: null,
        };
      },
      async getSession() {
        if (!session) return { data: { session: null }, error: null };
        return {
          data: {
            session: {
              user: { id: session.userId },
              expiresAt: session.expiresAt.toISOString(),
            },
          },
          error: null,
        };
      },
      async signOut() {
        return { data: null, error: null };
      },
      async updateUser(attributes?: { password?: string; email?: string }) {
        if (!session?.userId) {
          return { data: { user: null }, error: { message: "Brak sesji" } };
        }
        if (attributes?.password) {
          await updatePassword(
            session.userId,
            await hashPassword(attributes.password)
          );
        }
        if (attributes?.email) {
          return {
            data: { user: null },
            error: { message: "Zmiana e-maila nie jest obsługiwana tą ścieżką" },
          };
        }
        return { data: { user: { id: session.userId } }, error: null };
      },
      async signInWithPassword() {
        return {
          data: { user: null, session: null },
          error: { message: "Użyj POST /api/auth/login" },
        };
      },
    },
  };
}
