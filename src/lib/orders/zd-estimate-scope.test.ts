import { describe, expect, it } from "vitest";
import {
  assertZdEstimateFilterEcho,
  resolveZdEstimateRunScope,
} from "@/lib/orders/zd-estimate-scope";

describe("resolveZdEstimateRunScope", () => {
  it("accepts mode=grupa with grupaId", () => {
    expect(
      resolveZdEstimateRunScope({ mode: "grupa", grupaId: 12 })
    ).toEqual({ ok: true, mode: "grupa", grupaId: 12, cechaId: null });
  });

  it("accepts mode=cecha with cechaId", () => {
    expect(
      resolveZdEstimateRunScope({ mode: "cecha", cechaId: 2738 })
    ).toEqual({ ok: true, mode: "cecha", grupaId: null, cechaId: 2738 });
  });

  it("backward-compat: grupaId alone without mode", () => {
    expect(resolveZdEstimateRunScope({ grupaId: 5 })).toEqual({
      ok: true,
      mode: "grupa",
      grupaId: 5,
      cechaId: null,
    });
  });

  it("rejects missing mode and ids (never unscoped)", () => {
    const r = resolveZdEstimateRunScope({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.title).toBe("Brak zakresu");
  });

  it("rejects mode=grupa without grupaId", () => {
    const r = resolveZdEstimateRunScope({ mode: "grupa" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.title).toBe("Brak grupy");
  });

  it("rejects mode=cecha without cechaId", () => {
    const r = resolveZdEstimateRunScope({ mode: "cecha" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.title).toBe("Brak cechy");
  });

  it("rejects XOR conflict when both ids present", () => {
    const r = resolveZdEstimateRunScope({
      mode: "grupa",
      grupaId: 1,
      cechaId: 2,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.title).toBe("Konflikt zakresu");
  });

  it("rejects mode=cecha with grupaId set", () => {
    const r = resolveZdEstimateRunScope({
      mode: "cecha",
      cechaId: 2738,
      grupaId: 12,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.title).toBe("Konflikt zakresu");
  });
});

describe("assertZdEstimateFilterEcho", () => {
  it("passes when grupaId echo matches", () => {
    expect(
      assertZdEstimateFilterEcho({
        mode: "grupa",
        expectedGrupaId: 12,
        expectedCechaId: null,
        parametry: { grupaId: 12 },
      })
    ).toEqual({ ok: true });
  });

  it("passes when cechaId echo matches", () => {
    expect(
      assertZdEstimateFilterEcho({
        mode: "cecha",
        expectedGrupaId: null,
        expectedCechaId: 2738,
        parametry: { cechaId: 2738 },
      })
    ).toEqual({ ok: true });
  });

  it("fails cecha mode when echo missing (stary API)", () => {
    const r = assertZdEstimateFilterEcho({
      mode: "cecha",
      expectedGrupaId: null,
      expectedCechaId: 2738,
      parametry: { grupaId: null },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.title).toBe("Filtr cechy nie potwierdzony");
  });

  it("fails cecha mode when echo id mismatches", () => {
    const r = assertZdEstimateFilterEcho({
      mode: "cecha",
      expectedGrupaId: null,
      expectedCechaId: 2738,
      parametry: { cechaId: 1 },
    });
    expect(r.ok).toBe(false);
  });

  it("fails grupa mode when echo missing", () => {
    const r = assertZdEstimateFilterEcho({
      mode: "grupa",
      expectedGrupaId: 12,
      expectedCechaId: null,
      parametry: {},
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.title).toBe("Filtr grupy nie potwierdzony");
  });
});
