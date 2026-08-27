/**
 * Most między „Notatką do sprawy” ZK a notatką w prośbie (sales_request_note).
 * Domyślnie notatka sprawy jest prywatna — dołączenie jest opt-in.
 */

import { polishPozycjeLabel } from "@/lib/email/polish-plural";
import { normalizeSalesRequestNote } from "@/lib/orders/sales-request-note";
import {
  isOpenProsbaOrder,
  isOrderRelevantToZkWatch,
  type ZkLinkableOrder,
} from "@/lib/sales/zk-watch-order-link";
import type { SalesZkWatch } from "@/types/database";

export type ZkCaseNoteProsbaStatus =
  | "none"
  | "private"
  | "planned"
  | "in_prosba"
  | "planned_pending_attach";

export type ZkCaseNotePendingAttachKind = "missing" | "stale" | "mixed";

export type ZkCaseNoteProsbaStatusCopy = {
  status: ZkCaseNoteProsbaStatus;
  /** Etykieta w modalu / sekcji notatki. */
  label: string;
  /** Krótka etykieta w wierszu listy ZK. */
  shortLabel: string;
  description: string;
  tone: "slate" | "indigo" | "amber" | "emerald";
};

export type ZkCaseNoteSyncMode = "safe_from_previous" | "force_mismatched";

export function normalizeZkCaseNote(value: string | null | undefined): string | null {
  return normalizeSalesRequestNote(value);
}

/** Czy treść notatki sprawy i notatki w prośbie to to samo (po normalizacji). */
export function zkCaseNoteMatchesRequestNote(
  caseNote: string | null | undefined,
  requestNote: string | null | undefined
): boolean {
  const a = normalizeZkCaseNote(caseNote);
  const b = normalizeZkCaseNote(requestNote);
  if (!a || !b) return false;
  return a === b;
}

export function openZkLinkedOrdersWithCaseNoteState(
  watch: Pick<SalesZkWatch, "id" | "zk_number" | "client_label" | "client_kh_id" | "note">,
  orders: readonly ZkLinkableOrder[]
): {
  openOrders: ZkLinkableOrder[];
  withNote: ZkLinkableOrder[];
  withoutNote: ZkLinkableOrder[];
} {
  const caseNote = normalizeZkCaseNote(watch.note);
  const openOrders = orders.filter(
    (order) =>
      isOpenProsbaOrder(order) && isOrderRelevantToZkWatch(order, watch as SalesZkWatch)
  );
  const withNote: ZkLinkableOrder[] = [];
  const withoutNote: ZkLinkableOrder[] = [];
  for (const order of openOrders) {
    if (zkCaseNoteMatchesRequestNote(caseNote, order.sales_request_note)) {
      withNote.push(order);
    } else {
      withoutNote.push(order);
    }
  }
  return { openOrders, withNote, withoutNote };
}

/**
 * Które otwarte prośby zaktualizować przy zapisie / „Dodaj teraz”.
 * - safe_from_previous: puste uwagi lub takie same jak poprzednia notatka ZK (bez nadpisywania obcej treści)
 * - force_mismatched: wszystkie otwarte bez aktualnej treści sprawy ZK
 */
export function resolveZkCaseNoteSyncOrderIds(input: {
  openOrders: readonly ZkLinkableOrder[];
  previousCaseNote: string | null | undefined;
  nextCaseNote: string | null | undefined;
  mode: ZkCaseNoteSyncMode;
}): string[] {
  const previous = normalizeZkCaseNote(input.previousCaseNote);
  const next = normalizeZkCaseNote(input.nextCaseNote);
  const ids: string[] = [];

  for (const order of input.openOrders) {
    const current = normalizeZkCaseNote(order.sales_request_note);

    if (input.mode === "force_mismatched") {
      if (next) {
        if (current !== next) ids.push(order.id);
      } else if (current) {
        ids.push(order.id);
      }
      continue;
    }

    // safe_from_previous
    if (next) {
      if (!current || (previous && current === previous)) {
        if (current !== next) ids.push(order.id);
      }
    } else if (previous && current === previous) {
      ids.push(order.id);
    }
  }

  return ids;
}

export function deriveZkCaseNotePendingAttachKind(
  withoutNote: readonly Pick<ZkLinkableOrder, "sales_request_note">[]
): ZkCaseNotePendingAttachKind {
  if (!withoutNote.length) return "missing";
  let withContent = 0;
  for (const order of withoutNote) {
    if (normalizeZkCaseNote(order.sales_request_note)) withContent += 1;
  }
  if (withContent === 0) return "missing";
  if (withContent === withoutNote.length) return "stale";
  return "mixed";
}

export function deriveZkCaseNoteProsbaStatus(input: {
  note: string | null | undefined;
  includeNoteInProsba: boolean;
  openOrderCount: number;
  openOrdersWithMatchingNoteCount: number;
}): ZkCaseNoteProsbaStatus {
  const note = normalizeZkCaseNote(input.note);
  if (!note) return "none";

  const allOpenHaveNote =
    input.openOrderCount > 0 &&
    input.openOrdersWithMatchingNoteCount >= input.openOrderCount;

  if (allOpenHaveNote) return "in_prosba";

  if (input.includeNoteInProsba) {
    if (input.openOrderCount > 0 && input.openOrdersWithMatchingNoteCount < input.openOrderCount) {
      return "planned_pending_attach";
    }
    return "planned";
  }

  return "private";
}

export function zkCaseNoteProsbaStatusCopy(
  status: ZkCaseNoteProsbaStatus,
  pendingKind: ZkCaseNotePendingAttachKind = "missing"
): ZkCaseNoteProsbaStatusCopy {
  switch (status) {
    case "none":
      return {
        status,
        label: "Brak notatki",
        shortLabel: "Brak notatki",
        description: "Dodaj notatkę, jeśli chcesz coś zapamiętać przy tym ZK.",
        tone: "slate",
      };
    case "private":
      return {
        status,
        label: "Tylko u Ciebie",
        shortLabel: "Prywatna",
        description:
          "Zakupy nie widzą tej notatki w prośbie. Włącz „Dołącz do prośby”, żeby ją przekazać.",
        tone: "indigo",
      };
    case "planned":
      return {
        status,
        label: "Dołączana do prośby",
        shortLabel: "Do prośby",
        description:
          "Przy „Utwórz prośbę” / „Uzupełnij” notatka trafi do uwag pozycji — zakupy ją zobaczą.",
        tone: "amber",
      };
    case "planned_pending_attach":
      if (pendingKind === "stale") {
        return {
          status,
          label: "Do zaktualizowania w prośbie",
          shortLabel: "Do aktualizacji",
          description:
            "W otwartej prośbie jest starsza treść. Zaktualizuj ją, żeby zakupy widziały aktualną notatkę.",
          tone: "amber",
        };
      }
      if (pendingKind === "mixed") {
        return {
          status,
          label: "Częściowo w prośbie",
          shortLabel: "Wymaga sync",
          description:
            "Część otwartych pozycji nie ma tej notatki albo ma starą treść. Zsynchronizuj z prośbą.",
          tone: "amber",
        };
      }
      return {
        status,
        label: "Do dołączenia do prośby",
        shortLabel: "Do dołączenia",
        description:
          "Jest otwarta prośba bez tej notatki. Możesz dodać ją teraz albo przy kolejnym uzupełnieniu.",
        tone: "amber",
      };
    case "in_prosba":
      return {
        status,
        label: "W prośbie",
        shortLabel: "W prośbie",
        description: "Ta sama treść jest już w notatce powiązanej prośby — zakupy ją widzą.",
        tone: "emerald",
      };
  }
}

export function zkCaseNoteAttachActionLabel(
  pendingKind: ZkCaseNotePendingAttachKind
): string {
  return pendingKind === "missing"
    ? "Dodaj teraz do otwartej prośby"
    : "Zaktualizuj w otwartej prośbie";
}

export function zkCaseNoteWithoutNoteCountLabel(count: number): string {
  const base = polishPozycjeLabel(count);
  return `${base} bez aktualnej notatki`;
}

/** Wstaw notatkę sprawy na linie prefill (wszystkie pozycje — spójny widok w panelu). */
export function applyZkCaseNoteToProsbaLines<T extends object>(
  lines: T[],
  caseNote: string | null | undefined
): Array<T & { requestNote: string }> {
  const note = normalizeZkCaseNote(caseNote);
  if (!note || !lines.length) return lines as Array<T & { requestNote: string }>;
  return lines.map((line) => ({
    ...line,
    requestNote: note,
  }));
}

export function shouldIncludeZkCaseNoteInPrefill(
  watch: Pick<SalesZkWatch, "note" | "include_note_in_prosba">
): boolean {
  return Boolean(watch.include_note_in_prosba && normalizeZkCaseNote(watch.note));
}
