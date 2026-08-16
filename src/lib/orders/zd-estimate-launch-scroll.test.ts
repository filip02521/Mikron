/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clampZdEstimateMainScroll,
  clampZdEstimateScrollSurfaces,
  clampZdEstimateTableScroll,
  getZdEstimateUsefulScrollMax,
  parseCssLengthToPx,
  scrollZdEstimateAfterSelectionChange,
  scrollZdEstimateIntoView,
  scrollZdEstimatePageToBottom,
  scrollZdEstimateRevealListWhenReady,
  scrollZdEstimateTableRowIntoView,
  scrollZdEstimateWhenReady,
  ZD_ESTIMATE_LIST_FOCUS_ID,
  ZD_ESTIMATE_POST_CREATE_FOCUS_ID,
  ZD_ESTIMATE_SCROLL_END_ID,
  ZD_ESTIMATE_STICKY_ACTIONS_ID,
  ZD_ESTIMATE_TABLE_SCROLL_ID,
} from "@/lib/orders/zd-estimate-launch-scroll";

function mockMainScroll(opts?: {
  clientHeight?: number;
  scrollHeight?: number;
  scrollTop?: number;
}) {
  const main = document.createElement("main");
  Object.defineProperty(main, "clientHeight", {
    value: opts?.clientHeight ?? 300,
    configurable: true,
  });
  Object.defineProperty(main, "scrollHeight", {
    value: opts?.scrollHeight ?? 2000,
    configurable: true,
    writable: true,
  });
  main.style.overflowY = "auto";
  main.scrollTop = opts?.scrollTop ?? 0;
  const scrollTo = vi.fn((arg: ScrollToOptions | number) => {
    if (typeof arg === "object" && arg.top != null) {
      main.scrollTop = arg.top;
    }
  });
  main.scrollTo = scrollTo as unknown as typeof main.scrollTo;
  main.getBoundingClientRect = () =>
    ({
      top: 0,
      bottom: opts?.clientHeight ?? 300,
      height: opts?.clientHeight ?? 300,
      left: 0,
      right: 100,
      width: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  document.body.appendChild(main);
  return { main, scrollTo };
}

function mockTableScroll(opts?: {
  clientHeight?: number;
  scrollHeight?: number;
  scrollTop?: number;
}) {
  const table = document.createElement("div");
  table.id = ZD_ESTIMATE_TABLE_SCROLL_ID;
  Object.defineProperty(table, "clientHeight", {
    value: opts?.clientHeight ?? 200,
    configurable: true,
  });
  Object.defineProperty(table, "scrollHeight", {
    value: opts?.scrollHeight ?? 800,
    configurable: true,
  });
  table.scrollTop = opts?.scrollTop ?? 0;
  const scrollTo = vi.fn((arg: ScrollToOptions | number) => {
    if (typeof arg === "object" && arg.top != null) {
      table.scrollTop = arg.top;
    }
  });
  table.scrollTo = scrollTo as unknown as typeof table.scrollTo;
  table.getBoundingClientRect = () =>
    ({
      top: 0,
      bottom: opts?.clientHeight ?? 200,
      height: opts?.clientHeight ?? 200,
      left: 0,
      right: 100,
      width: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  document.body.appendChild(table);
  return { table, scrollTo };
}

/** h-0 dock + sticky bar + scroll-end sentinel (jak w workbenchu). */
function appendDockStickyEnd(
  main: HTMLElement,
  opts?: { endTop?: number; scrollTop?: number; dockBottom?: string }
) {
  const scrollTop = opts?.scrollTop ?? main.scrollTop;
  const endTopDoc = opts?.endTop ?? 900;
  const dock = document.createElement("div");
  dock.style.bottom = opts?.dockBottom ?? "56px";
  main.appendChild(dock);

  const sticky = document.createElement("div");
  sticky.id = ZD_ESTIMATE_STICKY_ACTIONS_ID;
  sticky.style.bottom = "0px";
  dock.appendChild(sticky);

  const end = document.createElement("div");
  end.id = ZD_ESTIMATE_SCROLL_END_ID;
  end.getBoundingClientRect = () =>
    ({
      top: endTopDoc - scrollTop,
      bottom: endTopDoc - scrollTop,
      height: 0,
      left: 0,
      right: 100,
      width: 100,
      x: 0,
      y: endTopDoc - scrollTop,
      toJSON: () => ({}),
    }) as DOMRect;
  main.appendChild(end);
  return { dock, sticky, end };
}

describe("zd-estimate-launch-scroll", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("eksportuje kotwicę panelu po create/link", () => {
    expect(ZD_ESTIMATE_POST_CREATE_FOCUS_ID).toBe(
      "zd-estimate-post-create-focus"
    );
  });

  it("scrolls scrollable parent instead of only window", () => {
    const { main, scrollTo } = mockMainScroll({
      clientHeight: 200,
      scrollHeight: 2000,
    });

    const el = document.createElement("div");
    el.id = "zd-estimate-launch-focus";
    el.getBoundingClientRect = () =>
      ({
        top: 400,
        bottom: 500,
        height: 100,
        left: 0,
        right: 0,
        width: 100,
        x: 0,
        y: 400,
        toJSON: () => ({}),
      }) as DOMRect;

    main.appendChild(el);

    expect(
      scrollZdEstimateIntoView("zd-estimate-launch-focus", { behavior: "auto" })
    ).toBe(true);
    expect(scrollTo).toHaveBeenCalled();
    const arg = scrollTo.mock.calls[0]?.[0] as { top: number };
    expect(arg.top).toBeGreaterThan(0);
  });

  it("returns false when missing", () => {
    expect(scrollZdEstimateIntoView("missing")).toBe(false);
  });

  it("retries whenReady until present", async () => {
    vi.useFakeTimers();
    const cancel = scrollZdEstimateWhenReady("late-el", {
      maxAttempts: 3,
      delayMs: 50,
    });
    const el = document.createElement("div");
    el.id = "late-el";
    el.scrollIntoView = vi.fn();
    document.body.appendChild(el);
    await vi.advanceTimersByTimeAsync(60);
    expect(el.scrollIntoView).toHaveBeenCalled();
    cancel();
    vi.useRealTimers();
  });

  it("parseCssLengthToPx — px / rem", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    expect(parseCssLengthToPx("56px", el)).toBe(56);
    expect(parseCssLengthToPx("3.5rem", el)).toBeCloseTo(56, 0);
  });

  it("getZdEstimateUsefulScrollMax — kończy na sentinel + dock bottom, nie hardMax", () => {
    const { main } = mockMainScroll({
      clientHeight: 400,
      scrollHeight: 2000,
      scrollTop: 0,
    });
    appendDockStickyEnd(main, { endTop: 900, scrollTop: 0 });
    expect(getZdEstimateUsefulScrollMax(main)).toBe(556);
  });

  it("clampZdEstimateMainScroll przycina do useful max (nie hardMax)", () => {
    const { main, scrollTo } = mockMainScroll({
      clientHeight: 400,
      scrollHeight: 2000,
      scrollTop: 1500,
    });
    main.scrollTop = 1500;
    appendDockStickyEnd(main, { endTop: 900, scrollTop: 1500 });
    expect(clampZdEstimateMainScroll()).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith({ top: 556, behavior: "auto" });
  });

  it("clampZdEstimateTableScroll przycina overscroll tabeli", () => {
    const { scrollTo } = mockTableScroll({
      clientHeight: 200,
      scrollHeight: 500,
      scrollTop: 400,
    });

    expect(clampZdEstimateTableScroll()).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith({ top: 300, behavior: "auto" });
  });

  it("clampZdEstimateScrollSurfaces — main + tabela", () => {
    const { main } = mockMainScroll({
      clientHeight: 400,
      scrollHeight: 2000,
      scrollTop: 1500,
    });
    main.scrollTop = 1500;
    appendDockStickyEnd(main, { endTop: 900, scrollTop: 1500 });
    mockTableScroll({
      clientHeight: 200,
      scrollHeight: 500,
      scrollTop: 400,
    });
    expect(clampZdEstimateScrollSurfaces()).toBe(true);
  });

  it("pageToBottom scrolluje do useful max", () => {
    const { main, scrollTo } = mockMainScroll({
      clientHeight: 400,
      scrollHeight: 3000,
    });
    appendDockStickyEnd(main, { endTop: 1000, scrollTop: 0 });
    expect(scrollZdEstimatePageToBottom({ behavior: "auto" })).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith({ top: 656, behavior: "auto" });
  });

  it("revealList scrolluje do content end", async () => {
    vi.useFakeTimers();
    const { main, scrollTo } = mockMainScroll({
      clientHeight: 400,
      scrollHeight: 3000,
    });

    const list = document.createElement("div");
    list.id = ZD_ESTIMATE_LIST_FOCUS_ID;
    list.tabIndex = -1;
    list.focus = vi.fn();
    main.appendChild(list);
    appendDockStickyEnd(main, { endTop: 1000, scrollTop: 0 });

    const cancel = scrollZdEstimateRevealListWhenReady({
      behavior: "auto",
      initialDelayMs: 100,
      settlePassesMs: [50, 100],
      maxAttempts: 6,
    });

    await vi.advanceTimersByTimeAsync(100);
    expect(scrollTo).toHaveBeenCalledWith({ top: 656, behavior: "auto" });
    await vi.advanceTimersByTimeAsync(200);
    expect(list.focus).toHaveBeenCalled();

    cancel();
    vi.useRealTimers();
  });

  it("scrollZdEstimateTableRowIntoView — nearest w TableScroll", () => {
    const { table, scrollTo } = mockTableScroll({ clientHeight: 200 });

    const row = document.createElement("tr");
    row.setAttribute("data-zd-estimate-tw-id", "42");
    row.getBoundingClientRect = () =>
      ({
        top: 250,
        bottom: 290,
        height: 40,
        left: 0,
        right: 100,
        width: 100,
        x: 0,
        y: 250,
        toJSON: () => ({}),
      }) as DOMRect;

    table.appendChild(row);

    expect(
      scrollZdEstimateTableRowIntoView(42, { behavior: "auto", block: "nearest" })
    ).toBe(true);
    expect(scrollTo).toHaveBeenCalled();
  });

  it("scrollZdEstimateAfterSelectionChange — zaznaczenie → content end", () => {
    const { main, scrollTo } = mockMainScroll({
      clientHeight: 400,
      scrollHeight: 2000,
    });
    appendDockStickyEnd(main, { endTop: 900, scrollTop: 0 });

    const cancel = scrollZdEstimateAfterSelectionChange({
      prevCount: 0,
      nextCount: 1,
      twId: 7,
      behavior: "auto",
    });
    expect(scrollTo).toHaveBeenCalledWith({ top: 556, behavior: "auto" });
    cancel();
  });

  it("scrollZdEstimateAfterSelectionChange — cancel kasuje follow-up 260ms", async () => {
    vi.useFakeTimers();
    const { main, scrollTo } = mockMainScroll({
      clientHeight: 400,
      scrollHeight: 2000,
    });
    appendDockStickyEnd(main, { endTop: 900, scrollTop: 0 });

    const cancel = scrollZdEstimateAfterSelectionChange({
      prevCount: 0,
      nextCount: 1,
      behavior: "auto",
    });
    const callsAfterImmediate = scrollTo.mock.calls.length;
    cancel();
    await vi.advanceTimersByTimeAsync(300);
    expect(scrollTo.mock.calls.length).toBe(callsAfterImmediate);
    vi.useRealTimers();
  });

  it("scrollZdEstimateAfterSelectionChange — odznaczenie ostatniego → wiersz", () => {
    vi.useFakeTimers();
    const { table, scrollTo } = mockTableScroll({ clientHeight: 200 });

    const row = document.createElement("tr");
    row.setAttribute("data-zd-estimate-tw-id", "9");
    row.getBoundingClientRect = () =>
      ({
        top: 400,
        bottom: 440,
        height: 40,
        left: 0,
        right: 100,
        width: 100,
        x: 0,
        y: 400,
        toJSON: () => ({}),
      }) as DOMRect;

    table.appendChild(row);

    scrollZdEstimateAfterSelectionChange({
      prevCount: 1,
      nextCount: 0,
      twId: 9,
      behavior: "auto",
    });
    expect(scrollTo).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
