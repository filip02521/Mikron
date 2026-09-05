/**
 * Ilości przy przełączaniu rodzaju prośby: zamowienie ↔ informacja.
 *
 * Informacja nie ma pola ilości — czyścimy je w UI.
 * Po powrocie na zamówienie przywracamy: stash (edycja użytkownika) → zkQuantity (ZK) → liczba zębów.
 */

export type RequestKindQuantityLine = {
  id: string;
  quantity: string;
  zkQuantity?: number | null;
  teethDetails?: readonly unknown[] | null;
};

/** Zrzut niepustych ilości (np. do testów / diagnostyki). */
export function snapshotNonEmptyQuantities(
  lines: ReadonlyArray<Pick<RequestKindQuantityLine, "id" | "quantity">>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of lines) {
    if (line.quantity.trim() !== "") {
      out[line.id] = line.quantity;
    }
  }
  return out;
}

/**
 * Aktualizacja stasha przy wejściu w „informacja”:
 * - niepusta ilość → zapisz (nadpisz)
 * - pusta ilość → usuń wpis (żeby nie przywracać starej wartości po ręcznym skasowaniu)
 */
export function updateStashOnInformacjaEnter(
  prevStash: Record<string, string>,
  lines: ReadonlyArray<Pick<RequestKindQuantityLine, "id" | "quantity">>
): Record<string, string> {
  let changed = false;
  const next = { ...prevStash };
  for (const line of lines) {
    if (line.quantity.trim() !== "") {
      if (next[line.id] !== line.quantity) {
        next[line.id] = line.quantity;
        changed = true;
      }
    } else if (line.id in next) {
      delete next[line.id];
      changed = true;
    }
  }
  return changed ? next : prevStash;
}

/** Usuwa wpisy dla linii, których już nie ma w formularzu. */
export function pruneQuantityStash(
  stash: Record<string, string>,
  lineIds: ReadonlyArray<string>
): Record<string, string> {
  const idSet = new Set(lineIds);
  let changed = false;
  const out: Record<string, string> = {};
  for (const [id, q] of Object.entries(stash)) {
    if (idSet.has(id)) {
      out[id] = q;
    } else {
      changed = true;
    }
  }
  return changed ? out : stash;
}

export function formatZkQuantityForDraft(
  zkQuantity: number | null | undefined
): string | null {
  if (zkQuantity == null || !Number.isFinite(zkQuantity) || zkQuantity <= 0) {
    return null;
  }
  return String(zkQuantity);
}

/**
 * Docelowa ilość po powrocie na „zamówienie u dostawcy”.
 * Preferuje stash (ręczna edycja), potem ilość z ZK, potem liczbę pozycji zębowych.
 */
export function resolveQuantityForZamowienie(
  line: RequestKindQuantityLine,
  stash: Record<string, string>
): string {
  const stashed = stash[line.id];
  if (stashed != null && stashed.trim() !== "") {
    return stashed;
  }

  const fromZk = formatZkQuantityForDraft(line.zkQuantity ?? null);
  if (fromZk) return fromZk;

  const teethCount = line.teethDetails?.length ?? 0;
  if (teethCount > 0) return String(teethCount);

  return line.quantity;
}

/** `null` = brak zmian (nie wołać onChange). */
export function applyInformacjaQuantityClear<T extends { quantity: string }>(
  lines: readonly T[]
): T[] | null {
  if (!lines.some((l) => l.quantity.trim() !== "")) return null;
  return lines.map((l) =>
    l.quantity.trim() !== "" ? { ...l, quantity: "" } : l
  );
}

/** `null` = brak zmian. Przywraca tylko puste quantity. */
export function applyZamowienieQuantityRestore<T extends RequestKindQuantityLine>(
  lines: readonly T[],
  stash: Record<string, string>
): T[] | null {
  let changed = false;
  const next = lines.map((l) => {
    if (l.quantity.trim() !== "") return l;
    const restored = resolveQuantityForZamowienie(l, stash);
    if (restored === l.quantity || restored.trim() === "") return l;
    changed = true;
    return { ...l, quantity: restored };
  });
  return changed ? next : null;
}
