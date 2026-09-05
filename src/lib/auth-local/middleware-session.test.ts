import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import { redirectWithSession } from "./middleware-session";

describe("redirectWithSession", () => {
  it("rozdziela pathname i query gdy ścieżka zawiera ?", () => {
    const request = new NextRequest("http://ontime.mikran.pl/login");
    const sessionResponse = NextResponse.next();
    sessionResponse.cookies.set("ontime_session", "tok");

    const redirect = redirectWithSession(
      request,
      sessionResponse,
      "/moje?dla=abc-123"
    );

    expect(redirect.status).toBe(307);
    expect(redirect.headers.get("location")).toBe(
      "http://ontime.mikran.pl/moje?dla=abc-123"
    );
    expect(redirect.cookies.get("ontime_session")?.value).toBe("tok");
  });

  it("łączy searchParams z query w ścieżce (searchParams wygrywa)", () => {
    const request = new NextRequest("http://127.0.0.1:3000/x");
    const redirect = redirectWithSession(
      request,
      NextResponse.next(),
      "/login?next=%2Fmoje",
      { reason: "session" }
    );

    const location = new URL(redirect.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/moje");
    expect(location.searchParams.get("reason")).toBe("session");
  });
});
