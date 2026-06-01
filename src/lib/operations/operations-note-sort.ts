import type { OperationsNote } from "@/types/database";

export function sortOperationsNotes(notes: OperationsNote[]): OperationsNote[] {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const orderA = a.sort_order ?? 0;
    const orderB = b.sort_order ?? 0;
    if (orderA !== orderB) return orderA - orderB;
    return b.updated_at.localeCompare(a.updated_at);
  });
}

export function notesInSamePinBand(a: OperationsNote, b: OperationsNote): boolean {
  return a.pinned === b.pinned;
}

export function reorderOperationsNoteIds(
  notes: OperationsNote[],
  fromId: string,
  toId: string
): string[] | null {
  const from = notes.find((n) => n.id === fromId);
  const to = notes.find((n) => n.id === toId);
  if (!from || !to || !notesInSamePinBand(from, to)) return null;

  const band = sortOperationsNotes(notes.filter((n) => n.pinned === from.pinned));
  const other = sortOperationsNotes(notes.filter((n) => n.pinned !== from.pinned));
  const ids = band.map((n) => n.id);
  const fromIndex = ids.indexOf(fromId);
  const toIndex = ids.indexOf(toId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return sortOperationsNotes(notes).map((n) => n.id);
  }

  const nextBand = [...ids];
  const [moved] = nextBand.splice(fromIndex, 1);
  nextBand.splice(toIndex, 0, moved!);

  return from.pinned
    ? [...nextBand, ...other.map((n) => n.id)]
    : [...other.map((n) => n.id), ...nextBand];
}

export function mergeOperationsSortOrders(
  notes: OperationsNote[],
  orderedIds: string[]
): OperationsNote[] {
  const byId = new Map(notes.map((n) => [n.id, n]));
  return orderedIds.map((id, index) => {
    const note = byId.get(id);
    if (!note) throw new Error(`Missing note ${id}`);
    return { ...note, sort_order: index };
  });
}
