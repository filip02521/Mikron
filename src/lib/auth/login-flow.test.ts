import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { runLoginFlow } from "@/lib/auth/login-flow";

const getSession = vi.fn();
const refreshSession = vi.fn();
const signInWithPassword = vi.fn();
const signOut = vi.fn();
const maybeSingle = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession,
      refreshSession,
      signInWithPassword,
      signOut,
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle,
        }),
      }),
    }),
  }),
}));

describe("runLoginFlow", () => {
  beforeEach(() => {
    getSession.mockReset();
    refreshSession.mockReset();
    signInWithPassword.mockReset();
    signOut.mockReset();
    maybeSingle.mockReset();
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("document", { cookie: "" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("nie woła signInWithPassword gdy API ustawiło sesję w cookies", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ ok: true, redirectTo: "/podsumowanie" })
    );
    getSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
    });

    const result = await runLoginFlow("jan@firma.pl", "secret", null);

    expect(result).toEqual({ ok: true, redirectTo: "/podsumowanie" });
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("używa signInWithPassword tylko gdy cookies API nie zsynchronizowały sesji", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ ok: true, redirectTo: "/moje" })
    );
    getSession.mockResolvedValue({ data: { session: null } });
    refreshSession.mockResolvedValue({ error: { message: "no session" } });
    signInWithPassword.mockResolvedValue({ error: null });

    const result = await runLoginFlow("jan@firma.pl", "secret", null);

    expect(result).toEqual({ ok: true, redirectTo: "/moje" });
    expect(signInWithPassword).toHaveBeenCalledTimes(1);
  });
});
