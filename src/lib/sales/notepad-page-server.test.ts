import { describe, expect, it } from "vitest";
import {
  buildNotatnikRouteRedirectUrl,
  buildZkRouteRedirectUrl,
  shouldRedirectNotatnikRouteToZk,
  shouldRedirectZkRouteToNotatnik,
} from "./notepad-page-server";

describe("notepad-page-server redirects", () => {
  it("przekierowuje /notatnik?tab=zk i focusWatch na /zk", () => {
    expect(shouldRedirectNotatnikRouteToZk({ tab: "zk" })).toBe(true);
    expect(shouldRedirectNotatnikRouteToZk({ focusWatch: "w-1" })).toBe(true);
    expect(shouldRedirectNotatnikRouteToZk({ tab: "notes" })).toBe(false);
  });

  it("buduje URL /zk z focusWatch", () => {
    expect(
      buildZkRouteRedirectUrl({
        searchParams: { dla: "sp-1", tab: "zk" },
        focusWatch: "w-1",
      })
    ).toBe("/zk?dla=sp-1&focusWatch=w-1#watch-w-1");
  });

  it("buduje URL /zk z archiwum przy focusWatch", () => {
    expect(
      buildZkRouteRedirectUrl({
        searchParams: { dla: "sp-1", tab: "archive" },
        focusWatch: "w-arch",
      })
    ).toBe("/zk?dla=sp-1&focusWatch=w-arch&tab=archive#watch-w-arch");
  });

  it("przekierowuje /zk?tab=notes na /notatnik", () => {
    expect(shouldRedirectZkRouteToNotatnik("notes")).toBe(true);
    expect(shouldRedirectZkRouteToNotatnik("archive")).toBe(false);
    expect(shouldRedirectZkRouteToNotatnik("zk")).toBe(false);
  });

  it("buduje URL /notatnik z archiwum", () => {
    expect(
      buildNotatnikRouteRedirectUrl({
        tab: "archive",
        searchParams: { dla: "sp-1", tab: "archive" },
      })
    ).toBe("/notatnik?dla=sp-1&tab=archive");
  });
});
