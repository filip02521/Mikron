/**
 * Widok odprawy — składanie wierszy z bazy w model dla ekranu, maila i Excela.
 * Czysta logika, bezpieczna dla klienta (tylko typy i funkcje).
 */

import type { CnLookup } from "./cn-nomenclature";
import { customsDescriptionWarning } from "./customs-description-check";
import {
  collectVatBasisDocuments,
  customsArticleKey,
  customsLineState,
  formatCustomsAgencyEmail,
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
  /** Kod HS nadawcy z faktury — podpowiedź dla CN. */
  invoiceHsCode: string | null;
  card: CustomsCardView | null;
  vat: ResolvedLineVat;
  state: CustomsLineState;
  /** Rozbieżność kodu CN do sprawdzenia (HS nadawcy, inny kod przy tym samym opisie, kod spoza CN). */
  cnWarning: string | null;
  /** Oficjalny opis kodu CN ze słownika (null = brak kodu albo kodu nie ma w CN). */
  cnDescription: string | null;
  /** Kod CN nie istnieje w aktualnej CN — pozycja nie trafia do maila, dopóki się go nie poprawi. */
  cnInvalid: boolean;
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
  hasInvoiceFile: boolean;
  /** Adres agencji, na który wysłano mail z aplikacji (null = oznaczone ręcznie). */
  agencyEmail: string | null;
  /** Podpowiedź adresu agencji: ten z odprawy albo ostatnio użyty. */
  defaultAgencyEmail: string | null;
  lines: CustomsLineView[];
  documents: CustomsSupplierDocumentView[];
  attachments: CustomsDocumentRef[];
  emailText: string;
  /** Pozycje bez opisu PL / kodu CN — nie ma ich w mailu, wysyłka zablokowana. */
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
  invoice_hs_code?: string | null;
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

/**
 * Pozycja nadaje się do maila: ma opis PL i istniejący kod CN (agencja potrzebuje kodu
 * przy każdej pozycji, a nieistniejący kod zatrzyma odprawę).
 */
export function isLineComplete(line: Pick<CustomsLineView, "card"> & { cnInvalid?: boolean }): boolean {
  return Boolean(line.card?.descriptionPl.trim() && line.card?.cnCode && !line.cnInvalid);
}

/** Klucz karty pozycji — także dla starszych odpraw zapisanych z pustym kodem (wtedy z nazwy). */
export function lineArticleKey(row: Pick<CustomsLineRow, "supplier_article_code" | "supplier_name">): string {
  return customsArticleKey(row.supplier_article_code, row.supplier_name);
}

function formatCn(cn: string): string {
  return `${cn.slice(0, 4)} ${cn.slice(4, 6)} ${cn.slice(6)}`;
}

/**
 * Kontrole kodu CN pozycji (tylko ostrzeżenia — decyzja należy do człowieka):
 * - inna pozycja (4 cyfry) niż HS nadawcy z faktury,
 * - ten sam opis PL i materiał, a różne kody CN w jednej odprawie.
 */
export function customsCnWarnings(
  lines: readonly Pick<CustomsLineView, "position" | "card" | "invoiceHsCode">[],
  dictionary?: CnLookup
): Map<number, string> {
  const out = new Map<number, string>();
  const byText = new Map<string, { position: number; cn: string }[]>();
  for (const l of lines) {
    const cn = l.card?.cnCode;
    if (!cn) continue;
    const text = `${l.card!.descriptionPl.trim().toLowerCase()}|${l.card!.material.trim().toLowerCase()}`;
    byText.set(text, [...(byText.get(text) ?? []), { position: l.position, cn }]);
  }
  for (const l of lines) {
    const cn = l.card?.cnCode;
    if (!cn) continue;
    const notes: string[] = [];
    if (dictionary && !dictionary.describe(cn)) {
      const near = dictionary.siblings(cn);
      notes.push(
        `Kodu ${formatCn(cn)} nie ma w CN ${dictionary.year}${near.length ? ` - istniejące w tej grupie: ${near.map(formatCn).join(", ")}` : ""}.`
      );
    }
    const text = `${l.card!.descriptionPl.trim().toLowerCase()}|${l.card!.material.trim().toLowerCase()}`;
    const others = (byText.get(text) ?? []).filter((o) => o.cn !== cn);
    if (others.length) {
      notes.push(
        `Ten sam opis ma inny kod CN w poz. ${others.map((o) => `${o.position} (${formatCn(o.cn)})`).join(", ")} - ujednolić albo doprecyzować opis.`
      );
    }
    if (l.invoiceHsCode && l.invoiceHsCode.slice(0, 4) !== cn.slice(0, 4)) {
      notes.push(`Dostawca podał HS ${l.invoiceHsCode} (pozycja ${l.invoiceHsCode.slice(0, 4)}), a CN to ${formatCn(cn)} - sprawdź.`);
    }
    if (notes.length) out.set(l.position, notes.join(" "));
  }
  return out;
}

export function buildCustomsLineViews(input: {
  lines: readonly CustomsLineRow[];
  cardsByCode: ReadonlyMap<string, CustomsCardRow>;
  documentIndex: CustomsDocumentArticleIndex;
  /** Słownik CN (tylko serwer) — bez niego nie sprawdzamy istnienia kodów. */
  cn?: CnLookup;
}): CustomsLineView[] {
  const views = [...input.lines]
    .sort((a, b) => a.position - b.position)
    .map((row) => {
      const code = lineArticleKey(row);
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
        invoiceHsCode: row.invoice_hs_code ?? null,
        card,
        vat,
        state: customsLineState(card, vat),
        cnWarning: null as string | null,
        cnDescription: (card?.cnCode && input.cn?.describe(card.cnCode)) || null,
        cnInvalid: Boolean(card?.cnCode && input.cn?.strict && !input.cn.describe(card.cnCode)),
      };
    });
  const cnWarnings = customsCnWarnings(views, input.cn);
  for (const v of views) {
    const description = v.card ? customsDescriptionWarning(v.card.descriptionPl, v.supplierName) : null;
    v.cnWarning = [cnWarnings.get(v.position), description].filter(Boolean).join(" ") || null;
  }
  return views;
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
    warningsCount: input.lines.filter((l) => l.vat.warning || l.cnWarning).length,
  };
}

export const CUSTOMS_LINE_STATE_LABEL: Record<CustomsLineState, string> = {
  confirmed: "Zatwierdzone wcześniej",
  confirmed_changed: "Do sprawdzenia",
  proposal: "Propozycja",
  missing: "Nowy artykuł",
};
