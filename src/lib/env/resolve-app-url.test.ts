import { describe, expect, it } from "vitest";
import {
  appUrlFromForwardedHeaders,
  isLoopbackAppUrl,
} from "@/lib/env/app-config";

describe("resolve-app-url helpers", () => {
  it("isLoopbackAppUrl rozpoznaje localhost", () => {
    expect(isLoopbackAppUrl("http://localhost:3000")).toBe(true);
    expect(isLoopbackAppUrl("http://127.0.0.1:3000")).toBe(true);
    expect(isLoopbackAppUrl("http://ontime.mikran.pl:3000")).toBe(false);
  });

  it("appUrlFromForwardedHeaders buduje URL z proxy", () => {
    const h = new Headers({
      "x-forwarded-proto": "http",
      "x-forwarded-host": "ontime.mikran.pl:3000",
    });
    expect(appUrlFromForwardedHeaders(h)).toBe("http://ontime.mikran.pl:3000");
  });

  it("appUrlFromForwardedHeaders używa host gdy brak forwarded", () => {
    const h = new Headers({ host: "192.168.0.140:3000" });
    expect(appUrlFromForwardedHeaders(h)).toBe("http://192.168.0.140:3000");
  });
});
