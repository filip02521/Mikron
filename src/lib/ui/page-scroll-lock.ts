"use client";

import { useLayoutEffect } from "react";

/** Oznacz wewnętrzny obszar modala/drawera, który nadal może scrollować. */
export const SCROLL_LOCK_ALLOW_ATTR = "data-scroll-lock-allow";

const LOCK_CLASS = "ontime-scroll-locked";

type SavedStyles = {
  htmlOverflow: string;
  bodyOverflow: string;
  bodyPaddingRight: string;
  mainOverflow: string;
  mainScrollTop: number;
};

let depth = 0;
let saved: SavedStyles | null = null;
const afterUnlockQueue: Array<() => void> = [];

function queryMain(): HTMLElement | null {
  const main = document.querySelector("main");
  return main instanceof HTMLElement ? main : null;
}

function isInsideScrollAllow(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(`[${SCROLL_LOCK_ALLOW_ATTR}]`));
}

function preventBackgroundScroll(event: Event) {
  if (isInsideScrollAllow(event.target)) return;
  event.preventDefault();
}

let listenersAttached = false;

function attachScrollBlockListeners() {
  if (listenersAttached) return;
  document.addEventListener("wheel", preventBackgroundScroll, { passive: false });
  document.addEventListener("touchmove", preventBackgroundScroll, { passive: false });
  listenersAttached = true;
}

function detachScrollBlockListeners() {
  if (!listenersAttached) return;
  document.removeEventListener("wheel", preventBackgroundScroll);
  document.removeEventListener("touchmove", preventBackgroundScroll);
  listenersAttached = false;
}

function flushAfterUnlockQueue(): void {
  if (afterUnlockQueue.length === 0) return;
  const queue = afterUnlockQueue.splice(0);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.setTimeout(() => {
        for (const fn of queue) fn();
      }, SCROLL_AFTER_UNLOCK_MS);
    });
  });
}

export function lockPageScroll(): void {
  depth += 1;
  if (depth !== 1) return;

  const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
  const main = queryMain();

  saved = {
    htmlOverflow: document.documentElement.style.overflow,
    bodyOverflow: document.body.style.overflow,
    bodyPaddingRight: document.body.style.paddingRight,
    mainOverflow: main?.style.overflow ?? "",
    mainScrollTop: main?.scrollTop ?? 0,
  };

  document.documentElement.classList.add(LOCK_CLASS);
  document.body.classList.add(LOCK_CLASS);
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
  if (scrollbarWidth > 0) {
    document.body.style.paddingRight = `${scrollbarWidth}px`;
  }
  if (main) {
    main.style.overflow = "hidden";
  }

  attachScrollBlockListeners();
}

export function unlockPageScroll(): void {
  if (depth === 0) return;
  depth -= 1;
  if (depth !== 0 || !saved) return;

  document.documentElement.classList.remove(LOCK_CLASS);
  document.body.classList.remove(LOCK_CLASS);
  document.documentElement.style.overflow = saved.htmlOverflow;
  document.body.style.overflow = saved.bodyOverflow;
  document.body.style.paddingRight = saved.bodyPaddingRight;

  const main = queryMain();
  if (main) {
    main.style.overflow = saved.mainOverflow;
  }

  detachScrollBlockListeners();
  saved = null;
  flushAfterUnlockQueue();
}

/**
 * Awaryjny reset — wymusza odblokowanie scrolla niezależnie od licznika depth.
 * Wywoływana przy zmianie trasy, aby wyczyścić zablokowane stany po unmount.
 */
export function forceUnlockAllScroll(): void {
  if (depth === 0 && !saved) return;

  depth = 0;

  document.documentElement.classList.remove(LOCK_CLASS);
  document.body.classList.remove(LOCK_CLASS);
  document.documentElement.style.overflow = saved?.htmlOverflow ?? "";
  document.body.style.overflow = saved?.bodyOverflow ?? "";
  document.body.style.paddingRight = saved?.bodyPaddingRight ?? "";

  const main = queryMain();
  if (main) {
    main.style.overflow = saved?.mainOverflow ?? "";
  }

  detachScrollBlockListeners();
  saved = null;
  afterUnlockQueue.length = 0;
}

/** Po zamknięciu overlayu — krótka pauza po odblokowaniu `<main>` (layout + smooth scroll). */
export const SCROLL_AFTER_UNLOCK_MS = 100;

export function runAfterScrollUnlock(fn: () => void, delayMs = SCROLL_AFTER_UNLOCK_MS): () => void {
  const run = () => {
    if (delayMs > 0) {
      window.setTimeout(fn, delayMs);
      return;
    }
    fn();
  };

  if (depth > 0) {
    afterUnlockQueue.push(run);
    return () => {
      const index = afterUnlockQueue.indexOf(run);
      if (index >= 0) afterUnlockQueue.splice(index, 1);
    };
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(run);
  });
  return () => {};
}

/**
 * Blokuje scroll strony (w tym `<main class="overflow-y-auto">`) pod modalem.
 *
 * Używaj przy każdym pełnoekranowym overlayu (modal, drawer, sheet).
 * Preferuj `ModalShell` — ma hook wbudowany. Własne overlaye: `useBodyScrollLock(open)`.
 * Scrollowalna treść wewnątrz overlayu: atrybut `data-scroll-lock-allow` (`SCROLL_LOCK_ALLOW_ATTR`).
 */
export function useBodyScrollLock(locked: boolean): void {
  useLayoutEffect(() => {
    if (!locked) return;
    lockPageScroll();
    return () => unlockPageScroll();
  }, [locked]);
}
