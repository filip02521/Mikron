/**
 * Pozycjonowanie floating toastów nad sticky dockiem kreatora ZD.
 * Indeks 0 = najniższy (pierwszy); kolejne piętra w górę — bez nakładania.
 */

import { cn } from "@/lib/cn";
import {
  floatingToastAboveZdStickyClass,
  floatingToastAboveZdStickyStackClass,
  floatingToastAboveZdStickyTallClass,
  floatingToastAboveZdStickyTallStackClass,
} from "@/lib/ui/sales-mobile-chrome";

/** Trzecie piętro (brak w chrome — lokalne do kreatora). */
const STACK_2 =
  "bottom-[calc(20.75rem+env(safe-area-inset-bottom,0px))] md:bottom-[15.75rem]";
const TALL_STACK_2 =
  "bottom-[calc(24.5rem+env(safe-area-inset-bottom,0px))] md:bottom-[18.75rem]";
const STACK_3 =
  "bottom-[calc(26.25rem+env(safe-area-inset-bottom,0px))] md:bottom-[20.25rem]";
const TALL_STACK_3 =
  "bottom-[calc(30rem+env(safe-area-inset-bottom,0px))] md:bottom-[23.25rem]";

/**
 * Klasa `bottom-*` dla toastu na danym piętrze.
 * `tallDock` = sticky z caption / zaznaczeniem (wyższy dock).
 */
export function zdEstimateStickyToastBottomClass(input: {
  stackIndex: number;
  tallDock: boolean;
}): string {
  const i = Math.max(0, Math.floor(input.stackIndex));
  if (input.tallDock) {
    if (i <= 0) return floatingToastAboveZdStickyTallClass;
    if (i === 1) return floatingToastAboveZdStickyTallStackClass;
    if (i === 2) return TALL_STACK_2;
    return TALL_STACK_3;
  }
  if (i <= 0) return floatingToastAboveZdStickyClass;
  if (i === 1) return floatingToastAboveZdStickyStackClass;
  if (i === 2) return STACK_2;
  return STACK_3;
}

export type ZdEstimateStickyToastId =
  | "launchReady"
  | "sessionRestored"
  | "recount"
  | "settingsLive";

/**
 * Kolejność od dołu (najważniejszy / najnowszy wynik listy na dole).
 * Zwraca mapę id → stackIndex tylko dla widocznych toastów.
 */
export function zdEstimateStickyToastStackIndices(visible: {
  launchReady?: boolean;
  sessionRestored?: boolean;
  recount?: boolean;
  settingsLive?: boolean;
}): Partial<Record<ZdEstimateStickyToastId, number>> {
  const order: ZdEstimateStickyToastId[] = [];
  if (visible.launchReady) order.push("launchReady");
  if (visible.sessionRestored) order.push("sessionRestored");
  if (visible.recount) order.push("recount");
  if (visible.settingsLive) order.push("settingsLive");

  const out: Partial<Record<ZdEstimateStickyToastId, number>> = {};
  order.forEach((id, index) => {
    out[id] = index;
  });
  return out;
}

export function zdEstimateStickyToastClass(input: {
  stackIndex: number;
  tallDock: boolean;
  extra?: string | false | null | undefined;
}): string {
  return cn(
    zdEstimateStickyToastBottomClass({
      stackIndex: input.stackIndex,
      tallDock: input.tallDock,
    }),
    input.extra
  );
}
