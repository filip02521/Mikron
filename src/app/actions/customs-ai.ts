"use server";

// @service-role-ok — autoryzacja requireOperations(); service role z pełnym scope po warstwie aplikacji.

import { revalidatePath } from "next/cache";
import { requireOperations } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { readStorageObject } from "@/lib/storage/local";
import {
  DOCUMENT_ARTICLES_PROMPT,
  DOCUMENT_ARTICLES_SCHEMA,
  INVOICE_EXTRACTION_PROMPT,
  INVOICE_EXTRACTION_SCHEMA,
  callCustomsGemini,
  documentArticlesToPasteText,
  invoiceLinesToPasteText,
  invoiceReadWarnings,
  isCustomsAiConfigured,
  parseDocumentArticlesExtraction,
  parseInvoiceExtraction,
  userFacingCustomsAiError,
  type InvoiceExtraction,
} from "@/lib/customs/customs-ai";
import { cleanUuid } from "@/lib/customs/customs-data";
import { proposeCustomsLines } from "@/lib/customs/customs-proposals";
import { CUSTOMS_AI_MIME, customsAiInlineData, customsFileMime } from "@/lib/customs/customs-ai-input";
import {
  isSpreadsheetFile,
  parseArticleCodesSheet,
  parseInvoiceWorkbook,
  readSpreadsheetSheets,
  sheetRowsToCsv,
  type SheetRows,
} from "@/lib/customs/customs-spreadsheet";

const AI_MIME = CUSTOMS_AI_MIME;
/** Limit inline danych w zapytaniu Gemini (~20 MB z narzutem base64). */
const MAX_AI_FILE_SIZE = 14 * 1024 * 1024;
const MAX_SHEET_FILE_SIZE = 20 * 1024 * 1024;

function emptyInvoice(lines: InvoiceExtraction["lines"]): InvoiceExtraction {
  return { invoiceNumber: "", invoiceDate: null, currency: null, total: null, hsCode: null, countryOfOrigin: null, lines };
}

/** Arkusz jako tekst dla AI — gdy układu kolumn nie da się rozpoznać regułami. */
async function invoiceFromSheetWithAi(sheets: SheetRows[]): Promise<InvoiceExtraction> {
  const csv = sheets.map((rows, i) => `--- Arkusz ${i + 1} ---\n${sheetRowsToCsv(rows)}`).join("\n");
  const raw = await callCustomsGemini(
    [{ text: `${INVOICE_EXTRACTION_PROMPT}\n\nFaktura jako arkusz (CSV, separator ;):\n${csv.slice(0, 120_000)}` }],
    INVOICE_EXTRACTION_SCHEMA
  );
  return parseInvoiceExtraction(raw);
}

export type ReadInvoiceFileResult = Result<{
  invoice: InvoiceExtraction;
  pasteText: string;
  /** Jak odczytano: kolumny arkusza, AI z arkusza albo AI z PDF/skanu. */
  method: "sheet" | "sheet_ai" | "ai";
  /** Opis rozpoznanych kolumn (dla arkusza) — do pokazania użytkownikowi. */
  note: string | null;
  /** Do sprawdzenia przed utworzeniem: pominięte koszty, niezgodna suma pozycji. */
  warnings: string[];
}>;

/**
 * Odczyt faktury / packing listy do formularza nowej odprawy:
 * - Excel (.xlsx / .xls) i CSV — kolumny rozpoznane po nagłówkach (PL/EN/DE), bez AI;
 *   gdy układ jest nietypowy, a AI jest włączone — AI czyta arkusz jako tekst,
 * - PDF i skany — AI (Gemini).
 */
export async function actionReadInvoiceFile(formData: FormData): Promise<ReadInvoiceFileResult> {
  await requireOperations("mutate");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Wybierz plik faktury.");
  const mime = file.type || "application/octet-stream";

  if (isSpreadsheetFile(file.name, mime)) {
    if (file.size > MAX_SHEET_FILE_SIZE) return fail("Plik przekracza 20 MB.");
    let sheets: SheetRows[];
    try {
      sheets = await readSpreadsheetSheets(Buffer.from(await file.arrayBuffer()), file.name);
    } catch (e) {
      console.error("[customs] sheet read:", e instanceof Error ? e.message : e);
      return fail("Nie udało się otworzyć arkusza - sprawdź, czy plik nie jest uszkodzony lub zabezpieczony hasłem.");
    }
    const parsed = parseInvoiceWorkbook(sheets);
    if (parsed && parsed.lines.length) {
      const h = parsed.headers;
      const note = [
        `Kolumny: kod „${h.code ?? "- (z nazwy)"}”`,
        `nazwa „${h.name ?? "-"}”`,
        `ilość „${h.qty}”`,
        `cena „${h.price ?? "-"}”`,
      ].join(", ");
      const skipped = parsed.skipped ? ` Pominięto ${parsed.skipped} wierszy bez ilości.` : "";
      return {
        ok: true,
        method: "sheet",
        invoice: emptyInvoice(parsed.lines),
        pasteText: invoiceLinesToPasteText(parsed.lines),
        note: `${note}.${skipped}`,
        warnings: [],
      };
    }
    if (!isCustomsAiConfigured()) {
      return fail(
        "Nie rozpoznano kolumn arkusza (szukam nagłówków typu kod / nazwa / ilość / cena). Skopiuj pozycje z Excela do pola poniżej."
      );
    }
    try {
      const invoice = await invoiceFromSheetWithAi(sheets);
      if (!invoice.lines.length) return fail("Nie znaleziono pozycji w arkuszu - wklej je ręcznie.");
      return {
        ok: true,
        method: "sheet_ai",
        invoice,
        pasteText: invoiceLinesToPasteText(invoice.lines),
        note: "Nietypowy układ arkusza - pozycje odczytało AI.",
        warnings: invoiceReadWarnings(invoice),
      };
    } catch (e) {
      console.error("[customs-ai] sheet invoice:", e instanceof Error ? e.message : e);
      return fail(userFacingCustomsAiError(e));
    }
  }

  if (!AI_MIME.has(customsFileMime(file.name, mime))) {
    return fail("Obsługiwane pliki: Excel (.xlsx, .xls), CSV, PDF i zdjęcia (JPG, PNG, TIF).");
  }
  if (!isCustomsAiConfigured()) {
    return fail("Odczyt PDF / skanów wymaga AI (GOOGLE_AI_API_KEY). Wgraj Excel / CSV albo wklej pozycje.");
  }
  const res = await actionExtractInvoiceWithAi(formData);
  return res.ok ? { ...res, method: "ai", note: null, warnings: invoiceReadWarnings(res.invoice) } : res;
}

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

export async function actionCustomsAiAvailable(): Promise<boolean> {
  await requireOperations("read");
  return isCustomsAiConfigured();
}

/** Odczyt faktury (PDF / skan) — wynik do przejrzenia w formularzu nowej odprawy. */
export async function actionExtractInvoiceWithAi(
  formData: FormData
): Promise<Result<{ invoice: InvoiceExtraction; pasteText: string }>> {
  await requireOperations("mutate");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Wybierz plik faktury.");
  if (file.size > MAX_AI_FILE_SIZE) return fail("Plik za duży dla AI (maks. 14 MB).");
  const mime = customsFileMime(file.name, file.type);
  if (!AI_MIME.has(mime)) return fail("Faktura musi być PDF albo zdjęciem (JPG, PNG, TIF).");
  try {
    const inlineData = await customsAiInlineData(Buffer.from(await file.arrayBuffer()), mime);
    const raw = await callCustomsGemini(
      [{ inlineData }, { text: INVOICE_EXTRACTION_PROMPT }],
      INVOICE_EXTRACTION_SCHEMA
    );
    const invoice = parseInvoiceExtraction(raw);
    if (!invoice.lines.length) return fail("AI nie znalazło pozycji na fakturze - wklej je ręcznie.");
    return { ok: true, invoice, pasteText: invoiceLinesToPasteText(invoice.lines) };
  } catch (e) {
    console.error("[customs-ai] invoice:", e instanceof Error ? e.message : e);
    return fail(userFacingCustomsAiError(e));
  }
}

/** Lista artykułów z dokumentu dostawcy (np. Annex A) — tekst do przejrzenia i zapisu. */
export async function actionExtractDocumentArticlesWithAi(
  documentId: string
): Promise<Result<{ text: string; count: number }>> {
  await requireOperations("mutate");
  const id = cleanUuid(documentId);
  if (!id) return fail("Dokument nie istnieje.");
  const supabase = createAdminClient();
  const { data: doc } = await supabase
    .from("supplier_customs_documents")
    .select("storage_path, mime_type, byte_size, file_name")
    .eq("id", id)
    .maybeSingle();
  if (!doc) return fail("Dokument nie istnieje.");
  const row = doc as { storage_path: string; mime_type: string; byte_size: number | null; file_name: string };
  if (isSpreadsheetFile(row.file_name, row.mime_type)) {
    try {
      const sheets = await readSpreadsheetSheets(await readStorageObject(row.storage_path), row.file_name);
      const articles = sheets.map(parseArticleCodesSheet).sort((a, b) => b.length - a.length)[0] ?? [];
      if (!articles.length) return fail("Nie znaleziono kodów artykułów w arkuszu.");
      return { ok: true, text: documentArticlesToPasteText(articles), count: articles.length };
    } catch (e) {
      console.error("[customs] document sheet:", e instanceof Error ? e.message : e);
      return fail("Nie udało się otworzyć arkusza dokumentu.");
    }
  }
  if (!AI_MIME.has(row.mime_type)) return fail("Kody czytam z Excela / CSV, a przez AI - z PDF i zdjęć.");
  if (!isCustomsAiConfigured()) return fail("Odczyt PDF / zdjęć wymaga AI (GOOGLE_AI_API_KEY).");
  if ((row.byte_size ?? 0) > MAX_AI_FILE_SIZE) return fail("Plik za duży dla AI (maks. 14 MB).");
  try {
    const bytes = await readStorageObject(row.storage_path);
    const raw = await callCustomsGemini(
      [{ inlineData: await customsAiInlineData(bytes, row.mime_type) }, { text: DOCUMENT_ARTICLES_PROMPT }],
      DOCUMENT_ARTICLES_SCHEMA
    );
    const articles = parseDocumentArticlesExtraction(raw);
    if (!articles.length) return fail("AI nie znalazło kodów artykułów w dokumencie.");
    return { ok: true, text: documentArticlesToPasteText(articles), count: articles.length };
  } catch (e) {
    console.error("[customs-ai] document:", e instanceof Error ? e.message : e);
    return fail(userFacingCustomsAiError(e));
  }
}

/**
 * Propozycje opisu PL / materiału / CN dla pozycji bez karty (lub z poprzednią propozycją AI).
 * Karty ręczne i zatwierdzone zostają nietknięte. VAT wynika z dokumentów dostawcy.
 */
export async function actionProposeCustomsLinesWithAi(
  clearanceId: string
): Promise<Result<{ proposed: number; uncertain: string[]; remaining: number }>> {
  const user = await requireOperations("mutate");
  const id = cleanUuid(clearanceId);
  if (!id) return fail("Odprawa nie istnieje.");
  const res = await proposeCustomsLines(createAdminClient(), id, user.id);
  if (res.ok) revalidatePath(`/zakupy/odprawy/${id}`);
  return res;
}
