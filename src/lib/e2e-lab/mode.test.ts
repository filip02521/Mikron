import { describe, expect, it, vi, afterEach } from "vitest";
import { E2E_LOGIN_DIRECTORY_FIXTURE, isE2ELab } from "@/lib/e2e-lab/mode";
import { fetchLoginDirectoryAccounts, sortLoginDirectoryAccounts } from "@/lib/auth/login-directory";
import { needsBootstrapSetup } from "@/lib/setup/bootstrap";
import { hasSupabaseConfig } from "@/lib/supabase/admin";
import { middlewareNeedsBootstrap } from "@/lib/setup/middleware-bootstrap";

describe("E2E lab mode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("detects E2E_LAB env", () => {
    vi.stubEnv("E2E_LAB", "1");
    expect(isE2ELab()).toBe(true);
    vi.stubEnv("E2E_LAB", "0");
    expect(isE2ELab()).toBe(false);
  });

  it("działa także przy NODE_ENV=production (next start w Playwright)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("E2E_LAB", "1");
    expect(isE2ELab()).toBe(true);
  });

  it("skips live Supabase config in lab mode", () => {
    vi.stubEnv("E2E_LAB", "1");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "ci-placeholder-service-key");
    expect(hasSupabaseConfig()).toBe(false);
  });

  it("returns login directory fixture without network", async () => {
    vi.stubEnv("E2E_LAB", "1");
    await expect(fetchLoginDirectoryAccounts()).resolves.toEqual(
      sortLoginDirectoryAccounts(E2E_LOGIN_DIRECTORY_FIXTURE)
    );
  });

  it("does not require bootstrap in lab mode", async () => {
    vi.stubEnv("E2E_LAB", "1");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "ci-placeholder-service-key");
    await expect(needsBootstrapSetup()).resolves.toBe(false);
    await expect(middlewareNeedsBootstrap()).resolves.toBe(false);
  });
});
