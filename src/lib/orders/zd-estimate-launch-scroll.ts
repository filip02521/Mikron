/**
 * Scroll focus dla flow „Przygotuj ZD” na /zakupy/szacunek.
 * appMain jest overflow-y-auto — natywny scrollIntoView często NIE rusza tego maina.
 */

export const ZD_ESTIMATE_LAUNCH_FOCUS_ID = "zd-estimate-launch-focus";
export const ZD_ESTIMATE_READY_FOCUS_ID = "zd-estimate-ready-focus";
export const ZD_ESTIMATE_ASSIGN_FOCUS_ID = "zd-estimate-assign-focus";
export const ZD_ESTIMATE_ERROR_FOCUS_ID = "zd-estimate-error-focus";
export const ZD_ESTIMATE_LIST_FOCUS_ID = "zd-estimate-list-focus";
export const ZD_ESTIMATE_SERVICES_FOCUS_ID = "zd-estimate-services-focus";
export const ZD_ESTIMATE_POLICZ_CTA_ID = "zd-estimate-policz-cta";

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

/**
 * Scroll do samego dołu scroll parenta (appMain) — po pełnym reveal listy.
 * Używa elementu listy tylko do znalezienia parenta.
 */
export function scrollZdEstimatePageToBottom(opts?: {
  behavior?: ScrollBehavior;
  fromElementId?: string;
}): boolean {
  if (typeof document === "undefined") return false;
  const behavior = opts?.behavior ?? "smooth";
  const fromId = opts?.fromElementId ?? ZD_ESTIMATE_LIST_FOCUS_ID;
  const el = document.getElementById(fromId);
  if (!el) return false;

  const parent = findScrollParent(el);
  if (parent) {
    const top = Math.max(0, parent.scrollHeight - parent.clientHeight);
    parent.scrollTo({ top, behavior });
    return true;
  }

  const scrolling =
    (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
  const top = Math.max(0, scrolling.scrollHeight - scrolling.clientHeight);
  scrolling.scrollTo({ top, behavior });
  return true;
}

/**
 * Po pierwszym Policz — gdy lista jest już w DOM, zjedź na sam dół strony.
 * Kilka passów po layout (prep collapsed, sticky Create, TableScroll).
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
  const settlePassesMs = opts?.settlePassesMs ?? [280, 520];
  const maxAttempts = opts?.maxAttempts ?? 24;

  const timers: ReturnType<typeof setTimeout>[] = [];
  let cancelled = false;
  let attempt = 0;

  const pass = (passBehavior: ScrollBehavior) => {
    if (cancelled) return false;
    return scrollZdEstimatePageToBottom({ behavior: passBehavior });
  };

  const run = () => {
    if (cancelled) return;
    attempt += 1;
    if (pass(behavior)) {
      for (const ms of settlePassesMs) {
        timers.push(
          setTimeout(() => {
            // Dociągnięcie po zmianie wysokości (sticky / tabela).
            pass(ms === settlePassesMs[0] ? behavior : "auto");
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
