/**
 * Co zrobić z paczką miesiąca po nowym skanie (§5 „Harmonogram” i „Stany paczki”).
 * Czysta reguła: zapis robi `data.ts`.
 */
import type { RolBatchDraft } from "./scan";

export type RolBatchStatus = "wykryte" | "brak_zakupow" | "przejrzane" | "wyslane" | "potwierdzone" | "do_korekty";

export const ROL_SENT_STATUSES: readonly RolBatchStatus[] = ["wyslane", "potwierdzone", "do_korekty"];

export type RolExistingBatch = {
  status: RolBatchStatus;
  contentHash: string;
  fsDokIds: readonly number[];
};

export type RolMergeDecision =
  /** Wynik bez zmian — tylko data skanu i licznik FS. */
  | { kind: "touch" }
  /** Nowa paczka albo nowy wynik przed wysyłką — podmiana FS i pozycji (z zachowaniem decyzji użytkownika). */
  | { kind: "replace"; status: RolBatchStatus; changeNote: string; clearReview: boolean }
  /** Paczka już wysłana — pozycji nie ruszamy, liczymy FS, które doszły po wysyłce. */
  | { kind: "late"; lateFsCount: number };

function fsDiffNote(before: readonly number[], after: readonly number[]): string {
  const prev = new Set(before);
  const next = new Set(after);
  const added = after.filter((id) => !prev.has(id)).length;
  const removed = before.filter((id) => !next.has(id)).length;
  const parts: string[] = [];
  if (added) parts.push(`+${added} FS`);
  if (removed) parts.push(`−${removed} FS`);
  return parts.length ? parts.join(", ") : "zmienione pozycje lub korekty";
}

export function decideRolMerge(existing: RolExistingBatch | null, draft: RolBatchDraft): RolMergeDecision {
  const draftFs = draft.invoices.map((i) => i.fsDokId);
  if (!existing) return { kind: "replace", status: draft.status, changeNote: "", clearReview: false };
  if (ROL_SENT_STATUSES.includes(existing.status)) {
    const sent = new Set(existing.fsDokIds);
    return { kind: "late", lateFsCount: draftFs.filter((id) => !sent.has(id)).length };
  }
  if (existing.contentHash === draft.contentHash) return { kind: "touch" };
  const note = fsDiffNote(existing.fsDokIds, draftFs);
  if (existing.status === "przejrzane") {
    // Po przeglądzie wynik się zmienił — wraca do przeglądu z widoczną różnicą.
    return {
      kind: "replace",
      status: draft.status === "brak_zakupow" ? "brak_zakupow" : "wykryte",
      changeNote: `${note} od przeglądu`,
      clearReview: true,
    };
  }
  return { kind: "replace", status: draft.status, changeNote: note, clearReview: false };
}
