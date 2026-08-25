/** Wspólne terminy copy na `/moje` — handlowiec-first, po polsku. */

/** Podmiot w komunikatach o uwagach / weryfikacji. */
export const MOJE_COPY_DEPARTMENT = "Dział zakupów";

/** Przycisk — uwagi przeczytane. */
export const MOJE_COPY_NOTES_ACK_BUTTON = "Przeczytałem/am";

/** CTA — zamknięcie anulowania/rezygnacji. */
export const MOJE_COPY_DISMISS_ACK_BUTTON = "Usuń z listy";

/** CTA — informacja o dostępności. */
export const MOJE_COPY_AVAILABILITY_ACK_BUTTON = "Potwierdź powiadomienie";

/** Termin z ERP — handlowiec-facing. */
export const MOJE_COPY_SUPPLIER_ORDER_TERM = "termin u dostawcy";

export function mojeCopyNotesAckTooltip(readBelow: boolean): string {
  if (readBelow) {
    return `${MOJE_COPY_DEPARTMENT} zaktualizował uwagi — przeczytaj poniżej i potwierdź ${MOJE_COPY_NOTES_ACK_BUTTON}`;
  }
  return `${MOJE_COPY_DEPARTMENT} zaktualizował uwagi — rozwiń, aby przeczytać`;
}
