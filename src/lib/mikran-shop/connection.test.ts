import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encryptToken } from "@/lib/google/gmail";

const query = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/pool", () => ({ query }));

const key = randomBytes(32);
type Row = { refresh_token_enc: string; access_token_enc: string | null; access_expires_at: Date | null; scope: string };
let row: Row | null;

function stubDb() {
  query.mockImplementation(async (sql: string, params: unknown[] = []) => {
    if (sql.includes("SELECT refresh_token_enc")) return { rows: row ? [row] : [] };
    if (sql.includes("UPDATE public.mikran_api_connection")) {
      const [access, expires, refresh] = params as [string, Date, string | null];
      row = { ...row!, access_token_enc: access, access_expires_at: expires, refresh_token_enc: refresh ?? row!.refresh_token_enc };
      return { rows: [] };
    }
    throw new Error(`unexpected SQL: ${sql}`);
  });
}

describe("mikranAccessToken", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("GOOGLE_OAUTH_TOKEN_KEY", key.toString("base64"));
    vi.stubEnv("MIKRAN_API_CLIENT_SECRET", "");
    query.mockReset();
    stubDb();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("brak połączenia → null, bez żądania do sklepu", async () => {
    row = null;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { mikranAccessToken } = await import("@/lib/mikran-shop/connection");
    expect(await mikranAccessToken()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ważny token → z bazy, bez odświeżania; force → odświeża", async () => {
    row = { refresh_token_enc: encryptToken(key, "refresh-1"), access_token_enc: encryptToken(key, "access-1"), access_expires_at: new Date(Date.now() + 3_600_000), scope: "helpdesk:read" };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ access_token: "access-2", expires_in: 3600 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { mikranAccessToken } = await import("@/lib/mikran-shop/connection");
    expect(await mikranAccessToken()).toBe("access-1");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await mikranAccessToken(true)).toBe("access-2");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("wygasły token: jedno odświeżenie dla równoczesnych żądań, nowy refresh token zapisany zaszyfrowany", async () => {
    row = { refresh_token_enc: encryptToken(key, "refresh-1"), access_token_enc: null, access_expires_at: null, scope: "" };
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = new URLSearchParams(String(init.body));
      expect(body.get("grant_type")).toBe("refresh_token");
      expect(body.get("refresh_token")).toBe("refresh-1");
      expect(body.get("client_id")).toBe("mk_f652e5ce44a93a3f88d05e32");
      expect(body.has("client_secret")).toBe(false);
      await new Promise((r) => setTimeout(r, 5));
      return new Response(JSON.stringify({ access_token: "access-2", refresh_token: "refresh-2", expires_in: 3600 }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { mikranAccessToken } = await import("@/lib/mikran-shop/connection");
    const [a, b] = await Promise.all([mikranAccessToken(), mikranAccessToken()]);
    expect([a, b]).toEqual(["access-2", "access-2"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(row!.refresh_token_enc).not.toContain("refresh-2");
    const { decryptToken } = await import("@/lib/google/gmail");
    expect(decryptToken(key, row!.refresh_token_enc)).toBe("refresh-2");
  });

  it("odrzucony refresh → komunikat o ponownym połączeniu", async () => {
    row = { refresh_token_enc: encryptToken(key, "refresh-1"), access_token_enc: null, access_expires_at: null, scope: "" };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 })));
    const { mikranAccessToken } = await import("@/lib/mikran-shop/connection");
    await expect(mikranAccessToken()).rejects.toThrow(/połącz je ponownie/);
  });
});
