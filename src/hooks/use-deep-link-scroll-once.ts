import { useEffect, useRef } from "react";

const DEFAULT_RETRY_MS = 120;
const MAX_SCROLL_ATTEMPTS = 8;

/** Przewija do elementu deep linku tylko raz na dany id — bez powtórzeń przy zmianie filtrów. */
export function useDeepLinkScrollOnce(
  elementId: string | null,
  enabled: boolean,
  delayMs = DEFAULT_RETRY_MS,
  block: ScrollLogicalPosition = "center"
) {
  const handledIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!elementId) {
      handledIdRef.current = null;
      return;
    }
    if (!enabled) return;
    if (handledIdRef.current === elementId) return;

    let cancelled = false;
    let attempts = 0;
    let retryTimer: number | undefined;

    const scroll = () => {
      if (cancelled || handledIdRef.current === elementId) return true;
      const el = document.getElementById(elementId);
      if (!el) return false;
      el.scrollIntoView({ behavior: "smooth", block });
      handledIdRef.current = elementId;
      return true;
    };

    const tryScroll = () => {
      if (scroll()) return;
      attempts += 1;
      if (attempts >= MAX_SCROLL_ATTEMPTS) return;
      retryTimer = window.setTimeout(tryScroll, delayMs);
    };

    tryScroll();

    return () => {
      cancelled = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [block, delayMs, elementId, enabled]);
}
