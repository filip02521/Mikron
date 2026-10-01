/**
 * Wejście pozycji odprawy: wklejona faktura (z PDF / Excela) albo ZD z Subiekta.
 * Czysta logika — bez bazy i sieci.
 */

import type { SubiektDocument } from "@/lib/subiekt/types";
import { normalizeArticleCode } from "./customs-clearance";

export type CustomsInputLine = {
  supplierArticleCode: string;
  supplierName: string;
  quantity: number;
  unitPrice: number | null;
  subiektTwId: number | null;
};

/** Liczba z polskim lub angielskim zapisem („1 234,50”, „1,234.50”, „5.5”). */
export function parseLooseNumber(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  let s = String(raw).replace(/[\s ]/g, "").replace(/[^0-9.,-]/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // Separator dziesiętny = ten, który występuje jako ostatni.
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma > -1) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function splitColumns(line: string): string[] {
  if (line.includes("\t")) return line.split("\t");
  if (line.includes(";")) return line.split(";");
  return line.split(/\s{2,}/);
}

/**
 * Wklejone pozycje faktury — jedna pozycja na wiersz:
 * `kod ⇥ nazwa ⇥ ilość ⇥ cena` (tabulator z Excela, średnik lub ≥2 spacje).
 * Wiersz nagłówka i puste wiersze są pomijane.
 */
export function parseInvoiceLinesPaste(text: string): {
  lines: CustomsInputLine[];
  errors: string[];
} {
  const lines: CustomsInputLine[] = [];
  const errors: string[] = [];
  const rows = text.split(/\r?\n/);
  rows.forEach((row, index) => {
    if (!row.trim()) return;
    const cols = splitColumns(row).map((c) => c.trim());
    const [code = "", name = "", qtyRaw = "", priceRaw = ""] = cols;
    const quantity = parseLooseNumber(qtyRaw);
    if (quantity == null) {
      // Nagłówek („Kod / Nazwa / Ilość”) albo wiersz bez ilości.
      if (index === 0 && lines.length === 0) return;
      errors.push(`Wiersz ${index + 1}: brak ilości („${row.trim().slice(0, 60)}”).`);
      return;
    }
    if (!code && !name) {
      errors.push(`Wiersz ${index + 1}: brak kodu i nazwy.`);
      return;
    }
    lines.push({
      supplierArticleCode: normalizeArticleCode(code),
      supplierName: name,
      quantity,
      unitPrice: parseLooseNumber(priceRaw),
      subiektTwId: null,
    });
  });
  return { lines, errors };
}

/** Pola, w których Subiekt trzyma symbol towaru u dostawcy (zależnie od wersji API). */
const SUPPLIER_SYMBOL_FIELDS = ["tw_DostSymbol", "ob_DostSymbol", "tw_SymbolDostawcy"] as const;

function stringField(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Pozycje ZD → pozycje odprawy. Kod artykułu: symbol u dostawcy, gdy API go podaje,
 * inaczej symbol Mikranu (do poprawienia ręcznie na kod z faktury).
 */
export function linesFromSubiektZd(doc: SubiektDocument): CustomsInputLine[] {
  return (doc.dok_Pozycja ?? []).map((line) => {
    const row = line as Record<string, unknown>;
    const supplierSymbol =
      SUPPLIER_SYMBOL_FIELDS.map((k) => stringField(row, k)).find(Boolean) ?? "";
    return {
      supplierArticleCode: normalizeArticleCode(supplierSymbol || line.tw_Symbol || ""),
      supplierName: (line.tw_Nazwa ?? "").trim(),
      quantity: Number(line.ob_Ilosc ?? 0) || 0,
      unitPrice: line.ob_CenaNetto ?? null,
      subiektTwId: line.ob_TowId ?? null,
    };
  });
}

/**
 * Lista artykułów z dokumentu dostawcy (np. Annex A deklaracji) — wklejona jako tekst.
 * Każdy wiersz: kod, opcjonalnie opis po tabulatorze / spacji.
 */
export function parseArticleCodesPaste(text: string): { code: string; description: string }[] {
  const seen = new Set<string>();
  const out: { code: string; description: string }[] = [];
  const rows = text.split(/\r?\n/).flatMap((row) => {
    // „DE-1411, DE-1412; DE-1332” — sama lista kodów w jednym wierszu.
    const parts = row.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
    return parts.length > 1 && parts.every((p) => !/\s/.test(p)) ? parts : [row];
  });
  for (const row of rows) {
    const trimmed = row.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^(\S+)(?:[\t ]+(.*))?$/);
    if (!match) continue;
    const code = normalizeArticleCode(match[1]);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push({ code, description: (match[2] ?? "").trim().slice(0, 300) });
  }
  return out;
}
