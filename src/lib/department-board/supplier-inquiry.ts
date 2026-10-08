/**
 * „Zapytaj dostawcę” z wątku tablicy — szkic maila o cenę, dostępność i termin.
 * Czyste funkcje (bez bazy) — zapis i odczyt w `supplier-inquiry-db.ts`.
 */

import type { DepartmentBoardThreadRow } from "@/lib/data/department-board-shared";

/**
 * Zapytanie wysłane z wątku (tabela supplier_inquiry_emails). Trafia też do handlowców —
 * celowo bez adresów e-mail (nadawcy i dostawcy).
 */
export type BoardSupplierInquiry = {
  id: string;
  /** null — dostawca usunięty z kartoteki (nazwa zostaje w supplierName). */
  supplierId: string | null;
  supplierName: string;
  sentAt: string;
  /** Zakupy odpisały w wątku po wysłaniu — wątek już nie czeka na dostawcę. */
  resolvedAt: string | null;
  /**
   * Ostatnia odpowiedź dostawcy (albo zwrot) z Poczty dostawców — synchronizacja Gmaila co kilka minut.
   * null = jeszcze nic nie przyszło (albo brak migracji 178).
   */
  replyAt?: string | null;
  /** Mail nie doszedł (zwrot z serwera poczty) — ostatnia wiadomość w sprawie to zwrot. */
  bounced?: boolean;
};

/** Dostawca odpisał (albo mail wrócił), a zakupy jeszcze nie odpowiedziały w wątku. */
export function inquiryNeedsAttention(i: BoardSupplierInquiry): boolean {
  return !i.resolvedAt && Boolean(i.replyAt);
}

export type SupplierInquiryProduct = Pick<
  DepartmentBoardThreadRow,
  "id" | "title" | "product_name" | "product_symbol" | "mikran_code"
>;

/** Krótki znacznik wątku w temacie — po nim da się później dopasować odpowiedź dostawcy. */
export function supplierInquiryRef(threadId: string): string {
  return `[OnTime #${threadId.replace(/-/g, "").slice(0, 8)}]`;
}

function productLines(product: SupplierInquiryProduct, english: boolean): { label: string; lines: string[] } {
  const name = product.product_name?.trim() || product.title.trim();
  const symbol = product.product_symbol?.trim() || product.mikran_code?.trim() || "";
  const lines = [name];
  if (symbol && !name.includes(symbol)) lines.push(`${english ? "Product code" : "Symbol / nr katalogowy"}: ${symbol}`);
  return { label: symbol && !name.includes(symbol) ? `${name} (${symbol})` : name, lines };
}

/**
 * Szkic do edycji przed wysyłką. Treść pytania handlowca celowo NIE trafia do maila —
 * bywają w niej dane klienta i uwagi wewnętrzne.
 */
export function buildSupplierInquiryDraft(input: {
  product: SupplierInquiryProduct;
  english: boolean;
  signature?: string;
}): { subject: string; body: string } {
  const { english } = input;
  const { label, lines } = productLines(input.product, english);
  const ref = supplierInquiryRef(input.product.id);
  const signature = input.signature?.trim();

  const body = english
    ? [
        "Hello,",
        "",
        "could you please send us information about the following product:",
        ...lines,
        "",
        "We would like to know:",
        "- the current net price,",
        "- availability,",
        "- lead time from order.",
        "",
        "Thank you in advance.",
        "Kind regards",
      ]
    : [
        "Dzień dobry,",
        "",
        "prosimy o informację w sprawie produktu:",
        ...lines,
        "",
        "Prosimy o:",
        "- aktualną cenę netto,",
        "- dostępność,",
        "- czas realizacji od zamówienia.",
        "",
        "Z góry dziękujemy.",
        "Pozdrawiamy",
      ];
  // Podpis z pożegnaniem („Pozdrawiam/Best Regards…”) zastępuje nasze — inaczej mail żegna się dwa razy.
  if (signature && /^(pozdrawiam|pozdrawiamy|z powa[zż]aniem|kind regards|best regards|regards|thank you)/i.test(signature)) {
    body.pop();
  }
  if (signature) body.push(signature);

  return {
    subject: `${english ? "Product inquiry" : "Zapytanie o produkt"}: ${label} ${ref}`,
    body: body.join("\n"),
  };
}

/** Czekające zapytanie do konkretnego dostawcy (nie tylko najnowsze w wątku). */
export function pendingInquiryToSupplier(
  inquiries: readonly BoardSupplierInquiry[] | undefined,
  supplierId: string
): BoardSupplierInquiry | null {
  return inquiries?.find((i) => !i.resolvedAt && i.supplierId === supplierId) ?? null;
}

/** Najnowsze zapytanie, na które zakupy jeszcze nie odpisały w wątku. */
export function pendingSupplierInquiry(
  inquiries: readonly BoardSupplierInquiry[] | undefined
): BoardSupplierInquiry | null {
  if (!inquiries?.length) return null;
  const latest = inquiries.reduce((a, b) => (b.sentAt > a.sentAt ? b : a));
  return latest.resolvedAt ? null : latest;
}
