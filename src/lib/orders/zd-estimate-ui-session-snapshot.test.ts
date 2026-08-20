/** @vitest-environment happy-dom */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  ZD_ESTIMATE_EXTERNAL_SESSION_AWAY_WINDOW_MS,
  ZD_ESTIMATE_EXTERNAL_SESSION_STORAGE_KEY,
  ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION,
  clearZdEstimateExternalSessionToken,
  createZdEstimateExternalSessionToken,
  peekZdEstimateExternalSessionToken,
  readZdEstimateExternalSessionToken,
} from "@/lib/orders/zd-estimate-external-session";
import { ZD_ESTIMATE_COLUMN_VISIBILITY_DEFAULTS } from "@/lib/orders/zd-estimate-prefs";
import {
  buildZdEstimateUiSessionSnapshot,
  parseZdEstimateUiSessionSnapshot,
} from "@/lib/orders/zd-estimate-ui-session-snapshot";

describe("zd-estimate-ui-session-snapshot", () => {
  it("builds snapshot with schema metadata", () => {
    const snapshot = buildZdEstimateUiSessionSnapshot({
      linesBase: [],
      lines: [],
      historyByTwId: [],
      historyFetchFailed: false,
      pendingIndividuals: [],
      pendingIndividualsTruncated: false,
      pendingIndividualsError: null,
      meta: {
        pagesFetched: 1,
        totalCountApi: 1,
        truncated: false,
        ordersBaseUrl: "http://test",
        durationMs: 10,
        totalFromSubiekt: 1,
      },
      missingPartnerTwIds: [],
      missingBomTwIds: [],
      paramInfo: {},
      exclusions: [],
      onRequests: [],
      packaging: [],
      productPairs: [],
      productBoms: [],
      teethTwIds: [],
      boostPreset: "standard",
      appliedBoostPreset: "standard",
      boostNeedsRecount: false,
      scopeMode: "grupa",
      selectedGroup: null,
      selectedCecha: null,
      groupQuery: "",
      cechaQuery: "",
      supplierId: null,
      dniZapasu: "14",
      dataOd: "2026-01-01",
      dataDo: "2026-01-31",
      zapasMin: "0",
      showAdvanced: false,
      salesWindowSource: "stock",
      qtyOverrideByTwId: {},
      acceptedReviewTwIds: {},
      sessionIncludeTwIds: {},
      listFilter: "order",
      listSearch: "",
      sortKey: "doZd",
      sortDir: "desc",
      columns: { ...ZD_ESTIMATE_COLUMN_VISIBILITY_DEFAULTS },
      columnOrder: [],
    });

    expect(snapshot.schemaVersion).toBe(
      ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION
    );
    expect(snapshot.createdAt).toBeTruthy();
    expect(snapshot.updatedAt).toBeTruthy();
    expect(parseZdEstimateUiSessionSnapshot(snapshot)).toEqual(snapshot);
  });

  it("parses legacy payload without embedded schemaVersion using fallback", () => {
    const legacy = {
      linesBase: [],
      lines: [],
      historyByTwId: [],
      scopeMode: "grupa",
      boostPreset: "standard",
      dataOd: "2026-01-01",
      dataDo: "2026-01-31",
      dniZapasu: "14",
      meta: {
        pagesFetched: 0,
        totalCountApi: 0,
        truncated: false,
        ordersBaseUrl: "http://test",
        durationMs: 0,
        totalFromSubiekt: 0,
      },
    };
    expect(
      parseZdEstimateUiSessionSnapshot(legacy, 1)
    ).not.toBeNull();
  });

  it("rejects payload with invalid meta or boost", () => {
    expect(
      parseZdEstimateUiSessionSnapshot({
        linesBase: [],
        lines: [],
        scopeMode: "grupa",
        schemaVersion: 1,
      })
    ).toBeNull();
  });
});

describe("zd-estimate-external-session peek", () => {
  beforeEach(() => {
    clearZdEstimateExternalSessionToken();
  });

  afterEach(() => {
    clearZdEstimateExternalSessionToken();
  });

  it("peek does not clear expired token from storage", () => {
    const now = 10_000;
    const rawToken = {
      sessionId: "s1",
      schemaVersion: ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION,
      supplierId: "sup1",
      scopeMode: "grupa",
      grupaId: 1,
      cechaId: null,
      remainingMs: ZD_ESTIMATE_EXTERNAL_SESSION_AWAY_WINDOW_MS,
      awayExpiresAtMs: now - 1,
    };

    window.sessionStorage.setItem(
      ZD_ESTIMATE_EXTERNAL_SESSION_STORAGE_KEY,
      JSON.stringify(rawToken)
    );

    expect(peekZdEstimateExternalSessionToken(now)).toBeNull();
    expect(
      window.sessionStorage.getItem(ZD_ESTIMATE_EXTERNAL_SESSION_STORAGE_KEY)
    ).not.toBeNull();

    expect(readZdEstimateExternalSessionToken(now)).toBeNull();
    expect(
      window.sessionStorage.getItem(ZD_ESTIMATE_EXTERNAL_SESSION_STORAGE_KEY)
    ).toBeNull();
  });

  it("peek returns valid token without mutation", () => {
    const token = createZdEstimateExternalSessionToken({
      sessionId: "s1",
      schemaVersion: ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION,
      supplierId: "sup1",
      scopeMode: "grupa",
      grupaId: 1,
      cechaId: null,
    });
    window.sessionStorage.setItem(
      ZD_ESTIMATE_EXTERNAL_SESSION_STORAGE_KEY,
      JSON.stringify(token)
    );
    expect(peekZdEstimateExternalSessionToken()?.sessionId).toBe("s1");
  });
});
