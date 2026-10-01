/**
 * Widok odprawy — składanie wierszy z bazy w model dla ekranu, maila i Excela.
 * Czysta logika, bezpieczna dla klienta (tylko typy i funkcje).
 */

import {
  collectVatBasisDocuments,
  customsLineState,
  formatCustomsAgencyEmail,
  normalizeArticleCode,
  resolveLineVat,
  type CustomsDocumentArticleIndex,
  type CustomsDocumentRef,
  type CustomsEmailLine,
  type CustomsLineState,
  type CustomsProductCard,
  type CustomsVatRate,
  type ResolvedLineVat,
} from "./customs-clearance";

export type CustomsCardView = CustomsProductCard & {
  id: string;
  source: NonNullable<CustomsProductCard["source"]>;
  confirmedAt: string | null;
};

export type CustomsLineView = {
  id: string;
  position: number;
  supplierArticleCode: string;
  supplierName: string;
  quantity: number;
  unit: string;
  unitPrice: number | null;
  amount: number | null;
  zdQuantity: number | null;
  card: CustomsCardView | null;
  vat: ResolvedLineVat;
  state: CustomsLineState;
};

export type CustomsSupplierDocumentView = CustomsDocumentRef & { articleCodes: string[] };

export type CustomsClearanceView = {
  id: string;
  supplierId: string;
  supplierName: string;
  zdNumber: string | null;
  invoiceNumber: string;
  invoiceDate: string | null;
  currency: string;
  shipmentDescription: string;
  invoiceFileName: string | null;
  status: "draft" | "sent";
  sentAt: string | null;
  sentEmailText: string | null;
  lines: CustomsLineView[];
  documents: CustomsSupplierDocumentView[];
  attachments: CustomsDocumentRef[];
  emailText: string;
  /** Pozycje bez opisu PL / kodu CN — mail jest niekompletny. */
  incompleteCount: number;
  warningsCount: number;
};

export type CustomsLineRow = {
  id: string;
  position: number;
  supplier_article_code: string;
  supplier_name: string;
  quantity: number | string;
  unit: string;
  unit_price: number | string | null;
  amount: number | string | null;
  zd_quantity: number | string | null;
};

export type CustomsCardRow = {
  id: string;
  supplier_article_code: string;
  description_pl: string;
  material: string;
  cn_code: string | null;
  is_medical_device: boolean;
  vat_rate: number | null;
  vat_basis_document_id: string | null;
  status: "proposed" | "confirmed";
  source: "manual" | "ai" | "copied";
  confirmed_at: string | null;
};

function num(v: number | string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function cardFromRow(row: CustomsCardRow): CustomsCardView {
  return {
    id: row.id,
    supplierArticleCode: row.supplier_article_code,
    descriptionPl: row.description_pl,
    material: row.material,
    cnCode: row.cn_code,
    isMedicalDevice: row.is_medical_device,
    vatRate: (row.vat_rate ?? null) as CustomsVatRate | null,
    vatBasisDocumentId: row.vat_basis_document_id,
    status: row.status,
    source: row.source,
    confirmedAt: row.confirmed_at,
  };
}

/** Pozycja nadaje się do maila: ma opis PL i kod CN. */
export function isLineComplete(line: Pick<CustomsLineView, "card">): boolean {
  return Boolean(line.card?.descriptionPl.trim() && line.card?.cnCode);
}

export function buildCustomsLineViews(input: {
  lines: readonly CustomsLineRow[];
  cardsByCode: ReadonlyMap<string, CustomsCardRow>;
  documentIndex: CustomsDocumentArticleIndex;
}): CustomsLineView[] {
  return [...input.lines]
    .sort((a, b) => a.position - b.position)
    .map((row) => {
      const code = normalizeArticleCode(row.supplier_article_code);
      const cardRow = code ? input.cardsByCode.get(code) : undefined;
      const card = cardRow ? cardFromRow(cardRow) : null;
      const vat = resolveLineVat({ articleCode: code, card, documentIndex: input.documentIndex });
      return {
        id: row.id,
        position: row.position,
        supplierArticleCode: code,
        supplierName: row.supplier_name,
        quantity: num(row.quantity) ?? 0,
        unit: row.unit,
        unitPrice: num(row.unit_price),
        amount: num(row.amount),
        zdQuantity: num(row.zd_quantity),
        card,
        vat,
        state: customsLineState(card, vat),
      };
    });
}

export function customsEmailLines(lines: readonly CustomsLineView[]): CustomsEmailLine[] {
  return lines.filter(isLineComplete).map((line) => ({
    position: line.position,
    descriptionPl: line.card!.descriptionPl,
    material: line.card!.material,
    cnCode: line.card!.cnCode,
    isMedicalDevice: line.vat.isMedicalDevice,
    vatRate: line.vat.rate,
  }));
}

export function buildCustomsClearanceSummary(input: {
  lines: CustomsLineView[];
  shipmentDescription: string;
}): Pick<CustomsClearanceView, "attachments" | "emailText" | "incompleteCount" | "warningsCount"> {
  const complete = input.lines.filter(isLineComplete);
  return {
    attachments: collectVatBasisDocuments(complete),
    emailText: formatCustomsAgencyEmail({
      shipmentDescription: input.shipmentDescription,
      lines: customsEmailLines(input.lines),
    }),
    incompleteCount: input.lines.length - complete.length,
    warningsCount: input.lines.filter((l) => l.vat.warning).length,
  };
}

export const CUSTOMS_LINE_STATE_LABEL: Record<CustomsLineState, string> = {
  confirmed: "Zatwierdzone wcześniej",
  confirmed_changed: "Do sprawdzenia",
  proposal: "Propozycja",
  missing: "Nowy artykuł",
};
