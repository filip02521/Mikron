/** @vitest-environment happy-dom */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { classifyUserFacingError } from "@/lib/ui/user-facing-error";

describe("session errors → login redirect classification", () => {
  it("mapuje Brak sesji", () => {
    expect(classifyUserFacingError("Brak sesji — zaloguj się ponownie.").kind).toBe(
      "session"
    );
  });

  it("mapuje Wymagane logowanie", () => {
    expect(classifyUserFacingError("Wymagane logowanie.").kind).toBe("session");
    expect(classifyUserFacingError("Wymagane logowanie").kind).toBe("session");
  });

  it("mapuje Brak aktywnej sesji", () => {
    expect(classifyUserFacingError("Brak aktywnej sesji.").kind).toBe("session");
  });
});

describe("redirectToLoginForLostSession", () => {
  beforeEach(() => {
    vi.resetModules();
    sessionStorage.clear();
    window.history.replaceState({}, "", "/kolejka");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("przypisuje /login?reason=session&next=…", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", {
      ...window.location,
      pathname: "/kolejka",
      search: "",
      assign,
    });
    const { redirectToLoginForLostSession } = await import(
      "@/lib/auth/session-login-redirect"
    );
    redirectToLoginForLostSession();
    expect(assign).toHaveBeenCalledWith(
      expect.stringMatching(/^\/login\?/)
    );
    expect(assign.mock.calls[0][0]).toMatch(/reason=session/);
    expect(assign.mock.calls[0][0]).toMatch(/next=/);
  });

  it("przy intentional nie dodaje reason=session", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", {
      ...window.location,
      pathname: "/kolejka",
      search: "",
      assign,
    });
    const { redirectToLoginForLostSession } = await import(
      "@/lib/auth/session-login-redirect"
    );
    redirectToLoginForLostSession({ intentional: true });
    expect(assign).toHaveBeenCalledWith("/login");
  });
});
