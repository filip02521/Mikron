/** @vitest-environment happy-dom */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  clearZdEstimateExternalSessionToken,
  createZdEstimateExternalSessionToken,
  writeZdEstimateExternalSessionToken,
  ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION,
} from "@/lib/orders/zd-estimate-external-session";
import {
  clearZdEstimateExternalSessionResumeQueryParam,
  isZdEstimateExternalSessionResumeUrl,
  isZdEstimateExternalSessionReturnNavigation,
  shouldShowZdEstimateSessionResumeLoading,
  ZD_ESTIMATE_EXTERNAL_SESSION_RESUME_QUERY,
} from "@/lib/orders/zd-estimate-external-session-resume";

describe("zd-estimate-external-session-resume", () => {
  beforeEach(() => {
    clearZdEstimateExternalSessionToken();
    window.history.replaceState({}, "", "/zakupy/szacunek");
  });

  afterEach(() => {
    clearZdEstimateExternalSessionToken();
    window.history.replaceState({}, "", "/");
  });

  it("detects resume query param", () => {
    expect(isZdEstimateExternalSessionResumeUrl("?resume=1")).toBe(true);
    expect(isZdEstimateExternalSessionResumeUrl("?autorun=1")).toBe(false);
  });

  it("detects return navigation from away timer", () => {
    const token = createZdEstimateExternalSessionToken({
      sessionId: "s1",
      schemaVersion: ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION,
      supplierId: "sup1",
      scopeMode: "grupa",
      grupaId: 1,
      cechaId: null,
    });
    writeZdEstimateExternalSessionToken({
      ...token,
      awayExpiresAtMs: Date.now() + 60_000,
    });
    expect(
      isZdEstimateExternalSessionReturnNavigation(
        createZdEstimateExternalSessionToken({
          sessionId: "s1",
          schemaVersion: ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION,
          supplierId: "sup1",
          scopeMode: "grupa",
          grupaId: 1,
          cechaId: null,
        })
      )
    ).toBe(false);
    expect(
      shouldShowZdEstimateSessionResumeLoading({
        token: {
          ...token,
          awayExpiresAtMs: Date.now() + 60_000,
        },
      })
    ).toBe(true);
  });

  it("does not show resume gate on refresh with paused token", () => {
    const token = createZdEstimateExternalSessionToken({
      sessionId: "s1",
      schemaVersion: ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION,
      supplierId: "sup1",
      scopeMode: "grupa",
      grupaId: 1,
      cechaId: null,
    });
    expect(
      shouldShowZdEstimateSessionResumeLoading({
        token,
        search: "",
      })
    ).toBe(false);
  });

  it("clears resume query param from url", () => {
    window.history.replaceState({}, "", `/zakupy/szacunek?${ZD_ESTIMATE_EXTERNAL_SESSION_RESUME_QUERY}=1`);
    clearZdEstimateExternalSessionResumeQueryParam();
    expect(window.location.search).toBe("");
  });
});
