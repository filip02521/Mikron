import { describe, expect, it } from "vitest";
import {
  assertLineKeyInSnapshot,
  assertOrphanLineKey,
  assertUnderZkLinkLimit,
  isExternalWarehouseUuid,
  normalizeLineNote,
  normalizePalletLabel,
  normalizeSiteNoteBody,
} from "./guards";
import { MAX_EXTERNAL_WAREHOUSE_ZK_LINKS } from "./constants";

const snap = {
  dok_Id: 1,
  lines: [{ key: "ob:1", tw_Nazwa: "A", ob_Ilosc: 2 }],
};

describe("external-warehouse guards", () => {
  it("waliduje UUID (IDOR — odrzuca śmieci z klienta)", () => {
    expect(isExternalWarehouseUuid("11111111-1111-4111-8111-111111111111")).toBe(
      true
    );
    expect(isExternalWarehouseUuid("not-a-uuid")).toBe(false);
    expect(isExternalWarehouseUuid("")).toBe(false);
    expect(isExternalWarehouseUuid("11111111-1111-1111-1111-111111111111")).toBe(
      false
    );
  });

  it("odrzuca line_key spoza snapshotu", () => {
    expect(assertLineKeyInSnapshot(snap, "ob:1")).toEqual({ ok: true });
    expect(assertLineKeyInSnapshot(snap, "ob:999").ok).toBe(false);
    expect(assertLineKeyInSnapshot(snap, "  ").ok).toBe(false);
  });

  it("orphan purge tylko poza snapshotem", () => {
    expect(assertOrphanLineKey(snap, "ob:999")).toEqual({ ok: true });
    expect(assertOrphanLineKey(snap, "ob:1").ok).toBe(false);
  });

  it("limit 10 ZK", () => {
    expect(assertUnderZkLinkLimit(0).ok).toBe(true);
    expect(assertUnderZkLinkLimit(9).ok).toBe(true);
    expect(assertUnderZkLinkLimit(MAX_EXTERNAL_WAREHOUSE_ZK_LINKS).ok).toBe(false);
    expect(assertUnderZkLinkLimit(99).ok).toBe(false);
  });

  it("clamp limity tekstu", () => {
    expect(normalizePalletLabel("x".repeat(100))?.length).toBe(80);
    expect(normalizeLineNote("n".repeat(3000))?.length).toBe(2000);
    expect(normalizeSiteNoteBody("  hello  ")).toBe("hello");
    expect(normalizePalletLabel("  ")).toBeNull();
  });
});
