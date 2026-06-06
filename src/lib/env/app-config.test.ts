import { describe, expect, it, vi } from "vitest";
import {
  getAppUrl,
  getSupabaseAuthRedirectUrls,
  isAppUrlProductionReady,
  isInternalAppHostname,
  normalizeAppBaseUrl,
} from "./app-config";

describe("app-config", () => {
  it("normalizuje końcowy slash", () => {
    expect(normalizeAppBaseUrl("http://ontime.mikran.pl/")).toBe("http://ontime.mikran.pl");
  });

  it("rozpoznaje wewnętrzną domenę mikran.pl", () => {
    expect(isInternalAppHostname("ontime.mikran.pl")).toBe(true);
    expect(isInternalAppHostname("192.168.0.140")).toBe(true);
    expect(isInternalAppHostname("localhost")).toBe(false);
  });

  it("akceptuje HTTP ontime.mikran.pl jako produkcyjny URL w LAN", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://ontime.mikran.pl:3000");
    expect(getAppUrl()).toBe("http://ontime.mikran.pl:3000");
    expect(isAppUrlProductionReady()).toBe(true);
    vi.unstubAllEnvs();
  });

  it("zbiera redirect URLs dla Supabase", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://ontime.mikran.pl:3000");
    vi.stubEnv("APP_SERVER_HOST", "192.168.0.140");
    vi.stubEnv("APP_PORT", "3000");
    const urls = getSupabaseAuthRedirectUrls();
    expect(urls).toContain("http://ontime.mikran.pl:3000/**");
    expect(urls).toContain("http://ontime.mikran.pl/**");
    vi.unstubAllEnvs();
  });
});
