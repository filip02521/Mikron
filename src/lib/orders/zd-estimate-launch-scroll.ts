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
