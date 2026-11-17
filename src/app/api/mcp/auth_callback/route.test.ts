import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getSessionUser = vi.hoisted(() => vi.fn());
const saveMikranConnection = vi.hoisted(() => vi.fn());
const exchangeMikranCode = vi.hoisted(() => vi.fn());
const assertAdminNotInReadOnlyPanelPreview = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ getSessionUser }));
vi.mock("@/lib/mikran-shop/connection", () => ({ saveMikranConnection }));
vi.mock("@/lib/auth/guard-admin-panel-preview", () => ({ assertAdminNotInReadOnlyPanelPreview }));
vi.mock("@/lib/mikran-shop/oauth", async (orig) => ({ ...(await orig<typeof import("@/lib/mikran-shop/oauth")>()), exchangeMikranCode }));

import { GET } from "./route";

const admin = { id: "u-admin", role: "admin", email: "admin.test@ontime.local" };
const req = (query: string, cookie = "ontime_mikran_oauth=st-1|u-admin|ver-1") =>
  new NextRequest(`http://localhost:3000/api/mcp/auth_callback?${query}`, { headers: cookie ? { cookie } : {} });

describe("GET /api/mcp/auth_callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUser.mockResolvedValue(admin);
    exchangeMikranCode.mockResolvedValue({ accessToken: "a", refreshToken: "r", expiresAt: new Date(), scope: "helpdesk:read helpdesk:write" });
  });

  it("admin, zgodny stan i kod → wymiana z weryfikatorem PKCE, zapis, powrót do panelu, ciasteczko usunięte", async () => {
    const res = await GET(req("code=c-1&state=st-1"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/admin#helpdesk-mikran$/);
    expect(exchangeMikranCode).toHaveBeenCalledWith("c-1", "ver-1");
    expect(saveMikranConnection).toHaveBeenCalledWith(expect.objectContaining({ refreshToken: "r" }), "u-admin");
    expect(res.headers.get("set-cookie")).toMatch(/ontime_mikran_oauth=;/);
  });

  it("admin w podglądzie innego panelu (tylko odczyt) → 403, nic nie zapisane", async () => {
    assertAdminNotInReadOnlyPanelPreview.mockRejectedValueOnce(new Error("Podgląd panelu jest tylko do odczytu."));
    const res = await GET(req("code=c-1&state=st-1"));
    expect(res.status).toBe(403);
    expect(exchangeMikranCode).not.toHaveBeenCalled();
    expect(saveMikranConnection).not.toHaveBeenCalled();
  });

  it("bez sesji → logowanie OnTime, nic nie zapisane", async () => {
    getSessionUser.mockResolvedValue(null);
    const res = await GET(req("code=c-1&state=st-1"));
    expect(res.headers.get("location")).toMatch(/\/login$/);
    expect(saveMikranConnection).not.toHaveBeenCalled();
  });

  it("serwisant łączy swoim kontem i wraca do zleceń", async () => {
    getSessionUser.mockResolvedValue({ ...admin, id: "u-serwis", role: "serwis" });
    const res = await GET(req("code=c-1&state=st-1", "ontime_mikran_oauth=st-1|u-serwis|ver-1"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/serwis\/zlecenia$/);
    expect(saveMikranConnection).toHaveBeenCalledWith(expect.anything(), "u-serwis");
  });

  it("inna rola (zakupy, magazyn, handlowiec) → 403, nic nie wymienione", async () => {
    getSessionUser.mockResolvedValue({ ...admin, role: "zakupy" });
    const res = await GET(req("code=c-1&state=st-1"));
    expect(res.status).toBe(403);
    expect(exchangeMikranCode).not.toHaveBeenCalled();
  });

  it("zły stan, brak ciasteczka, ciasteczko innej osoby, odmowa w sklepie, brak kodu → odrzucone bez wymiany", async () => {
    for (const r of [
      req("code=c-1&state=inny"),
      req("code=c-1&state=st-1", ""),
      req("code=c-1&state=st-1", "ontime_mikran_oauth=st-1|u-ktos|ver-1"),
      req("error=access_denied&state=st-1"),
      req("state=st-1"),
    ]) {
      const res = await GET(r);
      expect(res.status).toBe(400);
    }
    expect(exchangeMikranCode).not.toHaveBeenCalled();
    expect(saveMikranConnection).not.toHaveBeenCalled();
  });

  it("błąd sklepu przy wymianie → 502 z opisem, bez zapisu", async () => {
    const { MikranAuthError } = await import("@/lib/mikran-shop/oauth");
    exchangeMikranCode.mockRejectedValue(new MikranAuthError("Sklep mikran.pl odrzucił logowanie do API (400 invalid_grant)."));
    const res = await GET(req("code=c-1&state=st-1"));
    expect(res.status).toBe(502);
    expect(await res.text()).toContain("invalid_grant");
    expect(saveMikranConnection).not.toHaveBeenCalled();
  });

  it("inny błąd (np. bazy) → stały komunikat, bez szczegółów", async () => {
    saveMikranConnection.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5:5432"));
    const res = await GET(req("code=c-1&state=st-1"));
    expect(res.status).toBe(502);
    const html = await res.text();
    expect(html).not.toContain("ECONNREFUSED");
    expect(html).toContain("Spróbuj jeszcze raz");
  });
});
