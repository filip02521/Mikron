/**
 * Scroll focus dla flow „Przygotuj ZD” na /zakupy/szacunek.
 * appMain jest overflow-y-auto — natywny scrollIntoView często NIE rusza tego maina.
 */

export const ZD_ESTIMATE_LAUNCH_FOCUS_ID = "zd-estimate-launch-focus";
export const ZD_ESTIMATE_ASSIGN_FOCUS_ID = "zd-estimate-assign-focus";
export const ZD_ESTIMATE_ERROR_FOCUS_ID = "zd-estimate-error-focus";
export const ZD_ESTIMATE_LIST_FOCUS_ID = "zd-estimate-list-focus";
export const ZD_ESTIMATE_SERVICES_FOCUS_ID = "zd-estimate-services-focus";
export const ZD_ESTIMATE_POLICZ_CTA_ID = "zd-estimate-policz-cta";
/** Pasek akcji grupowych — nad sticky Create (dół strony). */
export const ZD_ESTIMATE_SELECTION_TOOLS_ID = "zd-estimate-selection-tools";
/** Sticky Utwórz ZD / TSV / Powiąż — kotwica wizualna. */
export const ZD_ESTIMATE_STICKY_ACTIONS_ID = "zd-estimate-sticky-actions";
/**
 * Sentinel tuż po sticky — zawsze w flow (sticky nie „przykleja” tego węzła).
 * To jest prawdziwy koniec treści; scroll max liczymy względem niego,
 * nie względem scrollHeight (padding main / sticky bottom zostawiały pustkę).
 */
export const ZD_ESTIMATE_SCROLL_END_ID = "zd-estimate-scroll-end";
export const ZD_ESTIMATE_TABLE_SCROLL_ID = "zd-estimate-table-scroll";
/** Panel po create/link — scroll w appMain. */
export const ZD_ESTIMATE_POST_CREATE_FOCUS_ID = "zd-estimate-post-create-focus";

function findScrollParent(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    const canScroll =
      (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
      node.scrollHeight > node.clientHeight + 1;
    if (canScroll) return node;
    node = node.parentElement;
  }
  return null;
}

/** AppShell `<main>` — właściwy scroll strony (nie TableScroll z max-h). */
function findAppMainScroll(
  fromElementId?: string
): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const main = document.querySelector("main");
  if (main instanceof HTMLElement) {
    const style = window.getComputedStyle(main);
    const overflowY = style.overflowY;
    if (
      overflowY === "auto" ||
      overflowY === "scroll" ||
      overflowY === "overlay"
    ) {
      return main;
    }
  }
  if (fromElementId) {
    const el = document.getElementById(fromElementId);
    if (el) return findScrollParent(el);
  }
  return null;
}

export function scrollZdEstimateIntoView(
  elementId: string,
  opts?: {
    behavior?: ScrollBehavior;
    block?: ScrollLogicalPosition;
    /** Extra offset from top of scroll parent (np. pod sticky header). */
    offsetPx?: number;
  }
): boolean {
  if (typeof document === "undefined") return false;
  const el = document.getElementById(elementId);
  if (!el) return false;

  const behavior = opts?.behavior ?? "smooth";
  const offsetPx = opts?.offsetPx ?? 12;
  const block = opts?.block ?? "start";

  const parent = findScrollParent(el);
  if (parent) {
    const elRect = el.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    let delta = elRect.top - parentRect.top - offsetPx;
    if (block === "center") {
      delta =
        elRect.top -
        parentRect.top -
        parent.clientHeight / 2 +
        elRect.height / 2;
    } else if (block === "end") {
      delta = elRect.bottom - parentRect.bottom + offsetPx;
    }
    const top = Math.max(0, parent.scrollTop + delta);
    parent.scrollTo({ top, behavior });
    return true;
  }

  // Fallback: window / document scrolling element
  el.scrollIntoView({ behavior, block });
  return true;
}

/** Ponawia scroll, aż element pojawi się w DOM (po setState / transition). */
export function scrollZdEstimateWhenReady(
  elementId: string,
  opts?: {
    behavior?: ScrollBehavior;
    block?: ScrollLogicalPosition;
    offsetPx?: number;
    maxAttempts?: number;
    delayMs?: number;
    initialDelayMs?: number;
  }
): () => void {
  const maxAttempts = opts?.maxAttempts ?? 12;
  const delayMs = opts?.delayMs ?? 50;
  const initialDelayMs = opts?.initialDelayMs ?? 0;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;

  const run = () => {
    if (cancelled) return;
    attempt += 1;
    if (scrollZdEstimateIntoView(elementId, opts)) {
      // Druga próba po layout — czasem main jeszcze nie ma finalnej wysokości.
      if (attempt < maxAttempts) {
        timer = setTimeout(() => {
          if (!cancelled) scrollZdEstimateIntoView(elementId, opts);
        }, 120);
      }
      return;
    }
    if (attempt < maxAttempts) {
      timer = setTimeout(run, delayMs);
    }
  };

  if (initialDelayMs > 0) {
    timer = setTimeout(run, initialDelayMs);
  } else if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => {
      if (!cancelled) run();
    });
  } else {
    timer = setTimeout(run, 0);
  }

  return () => {
    cancelled = true;
    if (timer != null) clearTimeout(timer);
  };
}

function clampScrollElement(el: HTMLElement, maxScrollTop?: number): boolean {
  const hardMax = Math.max(0, el.scrollHeight - el.clientHeight);
  const max =
    maxScrollTop == null
      ? hardMax
      : Math.max(0, Math.min(hardMax, maxScrollTop));
  if (el.scrollTop > max + 1) {
    el.scrollTo({ top: max, behavior: "auto" });
    return true;
  }
  return false;
}

/** Parsuj `bottom` sticky (px / rem) względem elementu. */
export function parseCssLengthToPx(
  raw: string,
  referenceEl: HTMLElement
): number {
  const v = raw.trim();
  if (!v || v === "auto") return 0;
  if (v.endsWith("px")) {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (v.endsWith("rem")) {
    const n = Number.parseFloat(v);
    if (!Number.isFinite(n)) return 0;
    const rootPx = Number.parseFloat(
      window.getComputedStyle(document.documentElement).fontSize || "16"
    );
    return n * (Number.isFinite(rootPx) ? rootPx : 16);
  }
  if (v.endsWith("em")) {
    const n = Number.parseFloat(v);
    if (!Number.isFinite(n)) return 0;
    const elPx = Number.parseFloat(
      window.getComputedStyle(referenceEl).fontSize || "16"
    );
    return n * (Number.isFinite(elPx) ? elPx : 16);
  }
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Y (w układzie scrolla `main`) prawdziwego końca treści
 * — sentinel po sticky, albo dół sticky, albo dół listy.
 */
export function getZdEstimateContentEndY(main: HTMLElement): number | null {
  const end =
    document.getElementById(ZD_ESTIMATE_SCROLL_END_ID) ||
    document.getElementById(ZD_ESTIMATE_STICKY_ACTIONS_ID) ||
    document.getElementById(ZD_ESTIMATE_LIST_FOCUS_ID);
  if (!end) return null;
  const mainRect = main.getBoundingClientRect();
  const endRect = end.getBoundingClientRect();
  // Sentinel: top = koniec treści. Sticky/list: użyj bottom.
  const useTop = end.id === ZD_ESTIMATE_SCROLL_END_ID;
  const edge = useTop ? endRect.top : endRect.bottom;
  return edge - mainRect.top + main.scrollTop;
}

/**
 * Max `scrollTop` bez pustki pod końcem treści.
 * Pasek Create jest w h-0 docku — nie dodajemy jego dawnego `bottom` do insetu
 * (to zawyżało useful max). Zostaje mały oddech + ewentualny bottom docka.
 */
export function getZdEstimateUsefulScrollMax(main: HTMLElement): number {
  const hardMax = Math.max(0, main.scrollHeight - main.clientHeight);
  const endY = getZdEstimateContentEndY(main);
  if (endY == null) return hardMax;

  const sticky = document.getElementById(ZD_ESTIMATE_STICKY_ACTIONS_ID);
  const dock = sticky?.parentElement ?? null;
  let bottomInset = 12;
  if (dock) {
    const bottomRaw = window.getComputedStyle(dock).bottom;
    const dockBottom = parseCssLengthToPx(bottomRaw, dock);
    // Dock `bottom` trzyma pasek nad nav — nie scrollujemy w padding main poniżej tego.
    if (dockBottom > 0) bottomInset = Math.max(12, Math.min(dockBottom, 72));
  }

  const useful = Math.max(0, endY - main.clientHeight + bottomInset);
  return Math.min(hardMax, useful);
}

/**
 * Przytnij scroll `<main>` do realnego zakresu treści (nie hard scrollHeight).
 */
export function clampZdEstimateMainScroll(
  fromElementId: string = ZD_ESTIMATE_LIST_FOCUS_ID
): boolean {
  if (typeof document === "undefined") return false;
  const parent = findAppMainScroll(fromElementId);
  if (parent) {
    return clampScrollElement(parent, getZdEstimateUsefulScrollMax(parent));
  }
  const scrolling =
    (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
  return clampScrollElement(scrolling);
}

/**
 * Przytnij wewnętrzny scroll tabeli (`#zd-estimate-table-scroll`).
 * Po filtrze / szukaniu content się kurczy — inaczej zostaje pusta powierzchnia.
 */
export function clampZdEstimateTableScroll(): boolean {
  if (typeof document === "undefined") return false;
  const table = document.getElementById(ZD_ESTIMATE_TABLE_SCROLL_ID);
  if (!table) return false;
  return clampScrollElement(table);
}

/** Main + tabela — typowe po zmianie filtra / reveal / zaznaczeniu. */
export function clampZdEstimateScrollSurfaces(
  fromElementId: string = ZD_ESTIMATE_LIST_FOCUS_ID
): boolean {
  const mainClamped = clampZdEstimateMainScroll(fromElementId);
  const tableClamped = clampZdEstimateTableScroll();
  return mainClamped || tableClamped;
}

/** Scroll `<main>` do useful max (koniec treści, bez pustki). */
export function scrollZdEstimateToContentEnd(opts?: {
  behavior?: ScrollBehavior;
  fromElementId?: string;
}): boolean {
  if (typeof document === "undefined") return false;
  const behavior = opts?.behavior ?? "smooth";
  const main = findAppMainScroll(opts?.fromElementId);
  if (!main) return false;
  const top = getZdEstimateUsefulScrollMax(main);
  main.scrollTo({ top, behavior });
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => {
      clampZdEstimateScrollSurfaces(opts?.fromElementId);
      requestAnimationFrame(() =>
        clampZdEstimateScrollSurfaces(opts?.fromElementId)
      );
    });
  } else {
    clampZdEstimateScrollSurfaces(opts?.fromElementId);
  }
  return true;
}

/**
 * Dół wyniku: useful content end — NIE surowy scrollHeight ani sticky block:end
 * (sticky bottom + padding main zostawiały pustkę pod paskiem Create).
 */
export function scrollZdEstimatePageToBottom(opts?: {
  behavior?: ScrollBehavior;
  fromElementId?: string;
}): boolean {
  if (typeof document === "undefined") return false;

  if (
    document.getElementById(ZD_ESTIMATE_SCROLL_END_ID) ||
    document.getElementById(ZD_ESTIMATE_STICKY_ACTIONS_ID) ||
    document.getElementById(ZD_ESTIMATE_LIST_FOCUS_ID)
  ) {
    return scrollZdEstimateToContentEnd(opts);
  }

  return false;
}

/** Wiersz tabeli szacunku — scroll wewnątrz TableScroll (i ewentualnie appMain). */
export function scrollZdEstimateTableRowIntoView(
  twId: number,
  opts?: {
    behavior?: ScrollBehavior;
    block?: ScrollLogicalPosition;
  }
): boolean {
  if (typeof document === "undefined") return false;
  const row = document.querySelector(
    `[data-zd-estimate-tw-id="${twId}"]`
  ) as HTMLElement | null;
  if (!row) return false;
  const behavior = opts?.behavior ?? "smooth";
  const block = opts?.block ?? "nearest";

  const tableScroll = document.getElementById(ZD_ESTIMATE_TABLE_SCROLL_ID);
  if (tableScroll) {
    const rowRect = row.getBoundingClientRect();
    const parentRect = tableScroll.getBoundingClientRect();
    const fullyVisible =
      rowRect.top >= parentRect.top - 1 &&
      rowRect.bottom <= parentRect.bottom + 1;
    if (!fullyVisible) {
      let delta = 0;
      if (block === "center") {
        delta =
          rowRect.top -
          parentRect.top -
          tableScroll.clientHeight / 2 +
          rowRect.height / 2;
      } else if (block === "end") {
        delta = rowRect.bottom - parentRect.bottom + 8;
      } else if (block === "start") {
        delta = rowRect.top - parentRect.top - 8;
      } else {
        // nearest
        if (rowRect.top < parentRect.top) {
          delta = rowRect.top - parentRect.top - 8;
        } else if (rowRect.bottom > parentRect.bottom) {
          delta = rowRect.bottom - parentRect.bottom + 8;
        }
      }
      if (delta !== 0) {
        tableScroll.scrollTo({
          top: Math.max(0, tableScroll.scrollTop + delta),
          behavior,
        });
      }
    }
  } else {
    row.scrollIntoView({ behavior, block });
  }
  return true;
}

/**
 * Po zmianie zaznaczenia:
 * - zaznaczenie → dół strony (pasek akcji + Create),
 * - odznaczenie ostatniego → wiersz w centrum uwagi,
 * - odznaczenie przy pozostałym zaznaczeniu → trzymaj pasek akcji w polu widzenia.
 *
 * Zwraca cancel — wywołaj przy cleanup effectu / szybkim select-deselect.
 */
export function scrollZdEstimateAfterSelectionChange(opts: {
  prevCount: number;
  nextCount: number;
  twId?: number | null;
  behavior?: ScrollBehavior;
}): () => void {
  if (typeof document === "undefined") return () => {};
  const behavior = opts.behavior ?? "smooth";
  const twId = opts.twId ?? null;
  let followUpTimer: ReturnType<typeof setTimeout> | null = null;

  if (opts.nextCount > opts.prevCount) {
    scrollZdEstimatePageToBottom({ behavior });
    // Po enter animacji paska (~240ms) dociągnij sticky + przytnij scroll.
    followUpTimer = setTimeout(() => {
      followUpTimer = null;
      scrollZdEstimatePageToBottom({ behavior: "auto" });
      clampZdEstimateScrollSurfaces();
      if (twId != null) {
        scrollZdEstimateTableRowIntoView(twId, {
          behavior,
          block: "nearest",
        });
      }
    }, 260);
    return () => {
      if (followUpTimer != null) clearTimeout(followUpTimer);
    };
  }

  if (opts.nextCount < opts.prevCount) {
    if (opts.nextCount === 0) {
      if (twId != null) {
        scrollZdEstimateTableRowIntoView(twId, {
          behavior,
          block: "center",
        });
      } else {
        scrollZdEstimateIntoView(ZD_ESTIMATE_LIST_FOCUS_ID, {
          behavior,
          block: "nearest",
          offsetPx: 16,
        });
      }
      return () => {};
    }

    scrollZdEstimateIntoView(ZD_ESTIMATE_SELECTION_TOOLS_ID, {
      behavior,
      block: "end",
      offsetPx: 88,
    });
    if (twId != null) {
      scrollZdEstimateTableRowIntoView(twId, {
        behavior,
        block: "nearest",
      });
    }
  }

  return () => {};
}

/**
 * Po pierwszym Policz — sticky Create (lub nagłówek listy) w polu widzenia.
 * Jedna kotwica na pass — bez list-start + sticky-end (to dawało flicker).
 */
export function scrollZdEstimateRevealListWhenReady(opts?: {
  behavior?: ScrollBehavior;
  initialDelayMs?: number;
  /** Dodatkowe passy po pierwszym udanym scrollu (ms od initialDelay). */
  settlePassesMs?: number[];
  maxAttempts?: number;
}): () => void {
  const behavior = opts?.behavior ?? "smooth";
  const initialDelayMs = opts?.initialDelayMs ?? 160;
  const settlePassesMs = opts?.settlePassesMs ?? [220, 480];
  const maxAttempts = opts?.maxAttempts ?? 24;

  const timers: ReturnType<typeof setTimeout>[] = [];
  let cancelled = false;
  let attempt = 0;

  const pass = (passBehavior: ScrollBehavior) => {
    if (cancelled) return false;
    // Koniec treści (useful max) — nie sticky block:end (zostawiał pustkę).
    if (
      document.getElementById(ZD_ESTIMATE_SCROLL_END_ID) ||
      document.getElementById(ZD_ESTIMATE_STICKY_ACTIONS_ID)
    ) {
      return scrollZdEstimateToContentEnd({ behavior: passBehavior });
    }
    const ok = scrollZdEstimateIntoView(ZD_ESTIMATE_LIST_FOCUS_ID, {
      behavior: passBehavior,
      block: "start",
      offsetPx: 12,
    });
    if (!ok) return false;
    clampZdEstimateScrollSurfaces();
    return true;
  };

  const run = () => {
    if (cancelled) return;
    attempt += 1;
    if (pass(attempt === 1 ? behavior : "auto")) {
      for (const ms of settlePassesMs) {
        timers.push(
          setTimeout(() => {
            if (cancelled) return;
            pass("auto");
            clampZdEstimateScrollSurfaces();
          }, ms)
        );
      }
      timers.push(
        setTimeout(() => {
          if (cancelled) return;
          const el = document.getElementById(ZD_ESTIMATE_LIST_FOCUS_ID);
          if (el && typeof el.focus === "function") {
            try {
              el.focus({ preventScroll: true });
            } catch {
              el.focus();
            }
          }
          clampZdEstimateScrollSurfaces();
        }, 80)
      );
      return;
    }
    if (attempt < maxAttempts) {
      timers.push(setTimeout(run, 50));
    }
  };

  timers.push(setTimeout(run, initialDelayMs));

  return () => {
    cancelled = true;
    for (const t of timers) clearTimeout(t);
  };
}
