/** Typy i obliczenia szkicu — bez `pg`, bezpieczne w komponentach klienta. */

export type PurchaseDraftStatus = "draft" | "submitted" | "cancelled";

export type PurchaseDraftLine = {
  id: string;
  subiektTwId: number;
  twSymbol: string | null;
  twNazwa: string;
  qty: number;
  suggestedQty: number;
  unitPriceNet: number | null;
  sortOrder: number;
};

export type PurchaseDraft = {
  id: string;
  supplierId: string;
  supplierName: string;
  status: PurchaseDraftStatus;
  note: string;
  zdDokId: number | null;
  zdDokNr: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines: PurchaseDraftLine[];
};

export type PurchaseDraftSummary = {
  id: string;
  supplierId: string;
  supplierName: string;
  status: PurchaseDraftStatus;
  lineCount: number;
  totalValue: number;
  pricedLineCount: number;
  zdDokNr: string | null;
  updatedAt: string;
};

/** Wartość netto szkicu — tylko pozycje z ceną (reszta liczona osobno w UI). */
export function purchaseDraftTotals(lines: readonly Pick<PurchaseDraftLine, "qty" | "unitPriceNet">[]): {
  totalValue: number;
  pricedLineCount: number;
} {
  let totalValue = 0;
  let pricedLineCount = 0;
  for (const line of lines) {
    if (line.unitPriceNet == null) continue;
    totalValue += line.qty * line.unitPriceNet;
    pricedLineCount += 1;
  }
  return { totalValue: Math.round(totalValue * 100) / 100, pricedLineCount };
}

