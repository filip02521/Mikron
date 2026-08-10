/**
 * Stan okna cofania panelu dziennego poza Reactem.
 *
 * Po Główne/Poboczne / Zamówione server action robi revalidatePath(layout) —
 * Next odświeża drzewo i useState w SummaryWorkspace znika. Ten store
 * przeżywa remount, więc floating UndoToast wraca z Cofnij.
 */

import type { DailyPanelUndoPayload } from "@/lib/orders/daily-panel-undo";
import {
  isUndoPayloadExpired,
  UNDO_WINDOW_MS,
} from "@/lib/orders/daily-panel-undo";

export type DailyPanelUndoUiState = {
  title: string;
  description?: string;
  detailLines?: string[];
  payload: DailyPanelUndoPayload;
  /** Koniec okna — timer toastu (zwykle z payload.expiresAt). */
  expiresAt: number;
};

let undoState: DailyPanelUndoUiState | null = null;
/**
 * Po udanej akcji z undo nie wołamy od razu router.refresh() —
 * revalidatePath z akcji i tak odświeża propsy; dodatkowy refresh
 * tuż po setUndo potrafi zabić toast przed przeniesieniem stanu do store.
 * Refresh odkładamy na dismiss / udane cofnięcie.
 */
let refreshAfterUndoDismiss = false;

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeDailyPanelUndo(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function getDailyPanelUndoSnapshot(): DailyPanelUndoUiState | null {
  return undoState;
}

/**
 * Musi zwracać to samo co {@link getDailyPanelUndoSnapshot}.
 * Wcześniej było zawsze `null` — po revalidate/remount (Główne / Uzupełniające)
 * React brał „server snapshot” i kasował floating UndoToast, mimo że store
 * nadal trzymał payload. „Zamówione” z Na dziś rzadziej wpadało w ten tor.
 */
export function getDailyPanelUndoServerSnapshot(): DailyPanelUndoUiState | null {
  return undoState;
}

export function setDailyPanelUndo(next: DailyPanelUndoUiState) {
  undoState = next;
  refreshAfterUndoDismiss = true;
  emit();
}

export function setDailyPanelUndoFromAction(input: {
  title: string;
  description?: string;
  detailLines?: string[];
  payload: DailyPanelUndoPayload;
}): DailyPanelUndoUiState {
  // Okno 10 s liczymy od pojawienia się toastu, nie od performedAt na serwerze
  // (latency + feedback potrafiły zjeść cały czas — zwłaszcza Uzupełniające).
  const performedAt = Date.now();
  const payload: DailyPanelUndoPayload = {
    ...input.payload,
    performedAt,
    expiresAt: performedAt + UNDO_WINDOW_MS,
  };
  const next: DailyPanelUndoUiState = {
    title: input.title,
    description: input.description,
    detailLines: input.detailLines,
    payload,
    expiresAt: performedAt + UNDO_WINDOW_MS,
  };
  setDailyPanelUndo(next);
  return next;
}

export function clearDailyPanelUndo() {
  undoState = null;
  emit();
}

/** true jeśli trzeba router.refresh() po zamknięciu okna cofania. */
export function consumeDailyPanelUndoRefreshFlag(): boolean {
  if (!refreshAfterUndoDismiss) return false;
  refreshAfterUndoDismiss = false;
  return true;
}

export function peekDailyPanelUndoRefreshFlag(): boolean {
  return refreshAfterUndoDismiss;
}

/** Jeśli stan w store jest po terminie — wyczyść (np. po remount). */
export function pruneExpiredDailyPanelUndo(at = Date.now()): boolean {
  if (!undoState) return false;
  if (
    !isUndoPayloadExpired(undoState.payload, at) &&
    undoState.expiresAt > at
  ) {
    return false;
  }
  undoState = null;
  emit();
  return true;
}

/** Testy / izolacja między case'ami. */
export function resetDailyPanelUndoStoreForTests() {
  undoState = null;
  refreshAfterUndoDismiss = false;
  emit();
}
