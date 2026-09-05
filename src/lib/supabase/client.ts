import { ensureCryptoRandomUUID } from "@/lib/ensure-crypto";

ensureCryptoRandomUUID();

export interface BrowserSession {
  user: { id: string } | null;
  expiresAt: string | null;
}

export type AuthChangeCallback = (
  event: string,
  session: BrowserSession | null
) => void;

async function fetchSession(): Promise<BrowserSession | null> {
  try {
    const response = await fetch("/api/auth/session", { cache: "no-store" });
    if (!response.ok) return null;
    const body = (await response.json()) as BrowserSession;
    return body.user ? body : null;
  } catch {
    return null;
  }
}

/**
 * Zgodność wsteczna dla kodu klienckiego wołającego `supabase.auth.*`.
 * Sesja jest httpOnly po stronie serwera — przeglądarka pyta o nią przez API,
 * więc nie ma tu zdarzeń zmiany stanu do subskrybowania.
 */
export function createClient() {
  return {
    auth: {
      async signOut() {
        await fetch("/api/auth/logout", { method: "POST" });
        return { error: null };
      },
      async getSession() {
        return { data: { session: await fetchSession() }, error: null };
      },
      async getUser() {
        const session = await fetchSession();
        return { data: { user: session?.user ?? null }, error: null };
      },
      /** Sesja serwerowa nie wymaga odświeżania — zostaje dla zgodności wywołań. */
      async refreshSession() {
        return { data: { session: await fetchSession() }, error: null };
      },
      async signInWithPassword(credentials: { email: string; password: string }) {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ ...credentials, next: null }),
        });
        const body = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          accountId?: string;
        };
        if (!response.ok || !body.ok || !body.accountId) {
          return {
            data: { user: null, session: null },
            error: { message: body.error ?? "Nie udało się zalogować." },
          };
        }
        const user = { id: body.accountId };
        return { data: { user, session: { user, expiresAt: null } }, error: null };
      },
      onAuthStateChange(_callback?: AuthChangeCallback) {
        void _callback;
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
  };
}
