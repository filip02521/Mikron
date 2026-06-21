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

  it("loguje przez accountId bez signInWithPassword gdy cookies API działają", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ ok: true, redirectTo: "/podsumowanie", accountId: "user-1" })
    );
    getSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
    });

    const result = await runLoginFlow({
      accountId: "acc-1",
      password: "secret",
      next: null,
    });

    expect(result).toEqual({ ok: true, redirectTo: "/podsumowanie", accountId: "user-1" });
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))).toMatchObject({
      accountId: "acc-1",
    });
  });

  it("używa signInWithPassword tylko gdy cookies API nie zsynchronizowały sesji", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ ok: true, redirectTo: "/moje", accountId: "acc-1" })
    );
    getSession.mockResolvedValue({ data: { session: null } });
    refreshSession.mockResolvedValue({ error: { message: "no session" } });
    signInWithPassword.mockResolvedValue({ error: null });

    const result = await runLoginFlow({
      accountId: "acc-1",
      email: "jan@firma.pl",
      password: "secret",
      next: null,
    });

    expect(result).toEqual({ ok: true, redirectTo: "/moje", accountId: "acc-1" });
    expect(signInWithPassword).toHaveBeenCalledTimes(1);
  });
});
