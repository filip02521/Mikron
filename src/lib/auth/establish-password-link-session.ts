import type { EmailOtpType } from "@/lib/auth/password-link-redirect";

export type PasswordLinkParseResult =
  | { kind: "code"; code: string }
  | { kind: "otp"; token_hash: string; type: EmailOtpType }
  | { kind: "hash"; access_token: string; refresh_token: string }
  | { kind: "none" };

type PasswordLinkAuthClient = {
  auth: {
    exchangeCodeForSession?: (code: string) => Promise<{ error: { message: string } | null }>;
    verifyOtp?: (params: {
      token_hash: string;
      type?: string | null;
    }) => Promise<{ error: { message: string } | null }>;
    setSession?: (tokens: {
      access_token: string;
      refresh_token: string;
    }) => Promise<{ error: { message: string } | null }>;
    getSession?: () => Promise<{ data: { session: unknown } }>;
  };
};

/** Wyciąga tokeny z query lub hash po przekierowaniu. */
export function parsePasswordLinkFromLocation(
  search: string,
  hash: string
): PasswordLinkParseResult {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

  const code = params.get("code");
  if (code) return { kind: "code", code };

  const token_hash = params.get("token_hash");
  const type = params.get("type");
  if (token_hash && type) {
    return { kind: "otp", token_hash, type: type as EmailOtpType };
  }

  const rawHash = hash.startsWith("#") ? hash.slice(1) : hash;
  if (rawHash) {
    const hashParams = new URLSearchParams(rawHash);
    const access_token = hashParams.get("access_token");
    const refresh_token = hashParams.get("refresh_token");
    if (access_token && refresh_token) {
      return { kind: "hash", access_token, refresh_token };
    }
  }

  return { kind: "none" };
}

export type EstablishPasswordLinkSessionResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Ustanawia sesję po kliknięciu linku zaproszenia / resetu hasła.
 * Preferowana ścieżka: pełne przekierowanie na `/auth/confirm` (ustawia cookie httpOnly).
 * Ten helper zostaje dla legacy client-side flows.
 */
export async function establishPasswordLinkSession(
  supabase: PasswordLinkAuthClient,
  location?: Pick<Location, "search" | "hash" | "pathname">
): Promise<EstablishPasswordLinkSessionResult> {
  const search = location?.search ?? "";
  const hash = location?.hash ?? "";
  const parsed = parsePasswordLinkFromLocation(search, hash);

  if (parsed.kind === "code") {
    if (!supabase.auth.exchangeCodeForSession) {
      return { ok: false, error: "missing_session" };
    }
    const { error } = await supabase.auth.exchangeCodeForSession(parsed.code);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  if (parsed.kind === "otp") {
    if (!supabase.auth.verifyOtp) {
      // Browser: przekieruj na confirm route
      if (typeof window !== "undefined") {
        const url = new URL("/auth/confirm", window.location.origin);
        url.searchParams.set("token_hash", parsed.token_hash);
        url.searchParams.set("type", parsed.type);
        window.location.assign(url.toString());
        return { ok: true };
      }
      return { ok: false, error: "missing_session" };
    }
    const { error } = await supabase.auth.verifyOtp({
      token_hash: parsed.token_hash,
      type: parsed.type,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  if (parsed.kind === "hash") {
    if (!supabase.auth.setSession) {
      return { ok: false, error: "missing_session" };
    }
    const { error } = await supabase.auth.setSession({
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  const sessionResult = await supabase.auth.getSession?.();
  if (sessionResult?.data?.session) return { ok: true };

  return { ok: false, error: "missing_session" };
}

export function scrubPasswordLinkFromUrl(
  pathname: string,
  search: string
): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  for (const key of [
    "code",
    "token_hash",
    "type",
    "error",
    "error_description",
    "blad",
  ]) {
    params.delete(key);
  }
  const q = params.toString();
  return q ? `${pathname}?${q}` : pathname;
}

export function scrubPasswordLinkFromLocation(
  pathname: string,
  search: string,
  hash: string
): string {
  void hash;
  return scrubPasswordLinkFromUrl(pathname, search);
}

export function locationHadPasswordLinkTokens(search: string, hash: string): boolean {
  return parsePasswordLinkFromLocation(search, hash).kind !== "none";
}
