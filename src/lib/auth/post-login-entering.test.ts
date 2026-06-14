import { describe, expect, it } from "vitest";
import {
  postLoginEnteringUrl,
  resolvePostLoginTarget,
  splitInternalRedirectPath,
} from "@/lib/auth/post-login-entering";

describe("resolvePostLoginTarget", () => {
  it("zwraca domyślnie / dla pustego lub zewnętrznego next", () => {
    expect(resolvePostLoginTarget(null)).toBe("/");
    expect(resolvePostLoginTarget("")).toBe("/");
    expect(resolvePostLoginTarget("https://evil.test")).toBe("/");
    expect(resolvePostLoginTarget("//evil.test")).toBe("/");
  });

  it("akceptuje wewnętrzne ścieżki panelu", () => {
    expect(resolvePostLoginTarget("/moje")).toBe("/moje");
    expect(resolvePostLoginTarget("/podsumowanie?tab=1")).toBe("/podsumowanie?tab=1");
  });

  it("blokuje trasy auth i pętlę entering", () => {
    expect(resolvePostLoginTarget("/login")).toBe("/");
    expect(resolvePostLoginTarget("/auth/entering")).toBe("/");
    expect(resolvePostLoginTarget("/auth/entering?next=%2Fmoje")).toBe("/moje");
    expect(resolvePostLoginTarget("/auth/entering?next=%2Flogin")).toBe("/");
  });
});

describe("postLoginEnteringUrl", () => {
  it("opakowuje panel w /auth/entering", () => {
    expect(postLoginEnteringUrl("/moje")).toBe("/auth/entering?next=%2Fmoje");
  });

  it("rozpakowuje zagnieżdżony entering i nie opakowuje ustaw-haslo", () => {
    expect(postLoginEnteringUrl("/ustaw-haslo?wymagane=1")).toBe(
      "/ustaw-haslo?wymagane=1"
    );
    expect(postLoginEnteringUrl("/auth/entering?next=%2Fmoje")).toBe(
      "/auth/entering?next=%2Fmoje"
    );
  });
});

describe("splitInternalRedirectPath", () => {
  it("dzieli pathname i query", () => {
    expect(splitInternalRedirectPath("/auth/entering?next=%2Fmoje")).toEqual({
      pathname: "/auth/entering",
      searchParams: { next: "/moje" },
    });
    expect(splitInternalRedirectPath("/moje")).toEqual({
      pathname: "/moje",
      searchParams: {},
    });
  });
});
