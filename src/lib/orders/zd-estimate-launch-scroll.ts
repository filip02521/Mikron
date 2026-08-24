/**
 * Scroll focus dla flow „Przygotuj ZD” na /zakupy/szacunek.
 * Historycznie appMain był overflow-y-auto; w fill-viewport main jest overflow:hidden
 * i scrollerem listy jest `#zd-estimate-table-scroll`.
 */

import { tryZdEstimateVirtualScrollToTwId } from "@/lib/orders/zd-estimate-table-virtual";

export const ZD_ESTIMATE_LAUNCH_FOCUS_ID = "zd-estimate-launch-focus";
/** Okno loadingu „Utwórz ZD” — ten sam chrome co Policz. */
export const ZD_ESTIMATE_CREATE_PROGRESS_FOCUS_ID =
  "zd-estimate-create-progress-focus";
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

/** AppShell `<main>` — tylko gdy faktycznie scrolluje (nie fill-viewport). */
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

function isZdEstimateViewportFill(): boolean {
  if (typeof document === "undefined") return false;
  return Boolean(document.querySelector("[data-zd-estimate-viewport]"));
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
    } else if (block === "nearest") {
      if (elRect.top >= parentRect.top - 1 && elRect.bottom <= parentRect.bottom + 1) {
        return true;
      }
      if (elRect.top < parentRect.top) {
        delta = elRect.top - parentRect.top - offsetPx;
      } else {
        delta = elRect.bottom - parentRect.bottom + offsetPx;
      }
    }
    if (Math.abs(delta) < 1) return true;
    const top = Math.max(0, parent.scrollTop + delta);
    parent.scrollTo({ top, behavior });
    return true;
  }

  // Fill-viewport: main nie scrolluje — nie wołaj window.scrollIntoView (skok strony).
  if (isZdEstimateViewportFill()) {
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
 * W trybie fill-viewport — no-op (brak page scroll).
 */
export function clampZdEstimateMainScroll(
  fromElementId: string = ZD_ESTIMATE_LIST_FOCUS_ID
): boolean {
  if (typeof document === "undefined") return false;
  const parent = findAppMainScroll(fromElementId);
  if (parent) {
    return clampScrollElement(parent, getZdEstimateUsefulScrollMax(parent));
  }
  if (isZdEstimateViewportFill()) return false;
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
  syncZdEstimateFlexibleColumnStickyWidths();
  return clampScrollElement(table);
}

/**
 * Nazwa może rosnąć z wolną szerokością — zsynchronizuj sticky left
 * (Opak. / Do ZD) z faktyczną szerokością kolumny Nazwa.
 * W trybie compact (≤767px Nazwa nie jest sticky) — czyść override.
 */
export function syncZdEstimateFlexibleColumnStickyWidths(): void {
  if (typeof document === "undefined") return;
  const table = document.querySelector(
    "table.data-table.zd-estimate-table"
  ) as HTMLTableElement | null;
  if (!table) return;
  const compact =
    getComputedStyle(table).getPropertyValue("--zd-est-compact-mode").trim() ===
    "1";
  if (compact) {
    if (table.style.getPropertyValue("--zd-est-name-used-w")) {
      table.style.removeProperty("--zd-est-name-used-w");
    }
    return;
  }
  const nameTh = table.querySelector(
    "thead th.zd-estimate-product-name-col"
  ) as HTMLTableCellElement | null;
  if (!nameTh) return;
  const w = nameTh.getBoundingClientRect().width;
  if (!(w > 0) || !Number.isFinite(w)) return;
  const px = `${Math.round(w * 100) / 100}px`;
  if (table.style.getPropertyValue("--zd-est-name-used-w") === px) return;
  table.style.setProperty("--zd-est-name-used-w", px);
}

/** Reset scrollu tabeli na początek (filtr / nowa lista w fill-viewport). */
export function resetZdEstimateTableScroll(opts?: {
  behavior?: ScrollBehavior;
}): boolean {
  if (typeof document === "undefined") return false;
  const table = document.getElementById(ZD_ESTIMATE_TABLE_SCROLL_ID);
  if (!table) return false;
  const behavior = opts?.behavior ?? "auto";
  if (table.scrollTop <= 0) {
    clampZdEstimateTableScroll();
    return true;
  }
  table.scrollTo({ top: 0, behavior });
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => {
      clampZdEstimateTableScroll();
    });
  } else {
    clampZdEstimateTableScroll();
  }
  return true;
}

/** Main + tabela — typowe po zmianie filtra / reveal / zaznaczeniu. */
export function clampZdEstimateScrollSurfaces(
  fromElementId: string = ZD_ESTIMATE_LIST_FOCUS_ID
): boolean {
  const mainClamped = clampZdEstimateMainScroll(fromElementId);
  const tableClamped = clampZdEstimateTableScroll();
  return mainClamped || tableClamped;
}

/**
 * Scroll do końca treści — tylko gdy `<main>` faktycznie scrolluje.
 * W fill-viewport Create jest zawsze widoczny: nie scrolluj tabeli na dół.
 */
export function scrollZdEstimateToContentEnd(opts?: {
  behavior?: ScrollBehavior;
  fromElementId?: string;
}): boolean {
  if (typeof document === "undefined") return false;
  const behavior = opts?.behavior ?? "smooth";
  const main = findAppMainScroll(opts?.fromElementId);
  if (main) {
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

  // Fill-viewport / brak page scroll: dock Create już w viewport — no-op na „dół”.
  if (isZdEstimateViewportFill()) {
    clampZdEstimateTableScroll();
    return true;
  }

  return scrollZdEstimateIntoView(
    opts?.fromElementId ?? ZD_ESTIMATE_LIST_FOCUS_ID,
    { behavior, block: "nearest", offsetPx: 16 }
  );
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
  const behavior = opts?.behavior ?? "smooth";
  const block = opts?.block ?? "nearest";

  const alignMountedRow = (row: HTMLElement): void => {
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
  };

  const row = document.querySelector(
    `[data-zd-estimate-tw-id="${twId}"]`
  ) as HTMLElement | null;
  if (row) {
    alignMountedRow(row);
    return true;
  }

  // Wirtualny tbody — wiersz poza overscanem nie jest w DOM.
  if (!tryZdEstimateVirtualScrollToTwId(twId)) return false;
  requestAnimationFrame(() => {
    const again = document.querySelector(
      `[data-zd-estimate-tw-id="${twId}"]`
    ) as HTMLElement | null;
    if (again) alignMountedRow(again);
  });
  return true;
}

/**
 * Po zmianie zaznaczenia:
 * - zaznaczenie → dół strony (pasek akcji + Create) — tylko gdy main scrolluje;
 *   w fill-viewport dock jest zawsze widoczny → wiersz nearest w tabeli,
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
  const fill = isZdEstimateViewportFill();

  if (opts.nextCount > opts.prevCount) {
    if (fill) {
      if (twId != null) {
        scrollZdEstimateTableRowIntoView(twId, {
          behavior,
          block: "nearest",
        });
      }
      clampZdEstimateTableScroll();
      return () => {};
    }
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

    if (!fill) {
      scrollZdEstimateIntoView(ZD_ESTIMATE_SELECTION_TOOLS_ID, {
        behavior,
        block: "end",
        offsetPx: 88,
      });
    }
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
 * Fill-viewport: Create już widoczny → fokus listy + tabela od góry (bez scrolla na dół).
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
  const fill = isZdEstimateViewportFill();

  const focusList = () => {
    const el = document.getElementById(ZD_ESTIMATE_LIST_FOCUS_ID);
    if (el && typeof el.focus === "function") {
      try {
        el.focus({ preventScroll: true });
      } catch {
        el.focus();
      }
    }
  };

  const passFill = () => {
    if (cancelled) return false;
    if (!document.getElementById(ZD_ESTIMATE_LIST_FOCUS_ID)) return false;
    resetZdEstimateTableScroll({ behavior: "auto" });
    focusList();
    clampZdEstimateScrollSurfaces();
    return true;
  };

  const passLegacy = (passBehavior: ScrollBehavior) => {
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
    const ok = fill
      ? passFill()
      : passLegacy(attempt === 1 ? behavior : "auto");
    if (ok) {
      for (const ms of settlePassesMs) {
        timers.push(
          setTimeout(() => {
            if (cancelled) return;
            if (fill) {
              passFill();
            } else {
              passLegacy("auto");
              clampZdEstimateScrollSurfaces();
            }
          }, ms)
        );
      }
      timers.push(
        setTimeout(() => {
          if (cancelled) return;
          focusList();
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
