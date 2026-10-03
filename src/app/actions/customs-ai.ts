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
  CN_VERIFY_SCHEMA,
  LINE_PROPOSALS_SCHEMA,
  buildCnVerifyPrompt,
  buildLineProposalsPrompt,
  callCustomsGemini,
  documentArticlesToPasteText,
  invoiceLinesToPasteText,
  invoiceReadWarnings,
  isCustomsAiConfigured,
  parseDocumentArticlesExtraction,
  parseInvoiceExtraction,
  parseCnVerify,
  parseLineProposals,
  userFacingCustomsAiError,
  type CnVerifyItem,
  type InvoiceExtraction,
  type LineProposal,
  type ProposalExample,
  type ProposalRequestLine,
} from "@/lib/customs/customs-ai";
import { cleanUuid, loadClearanceView, upsertCard } from "@/lib/customs/customs-data";
import { CUSTOMS_AI_MIME, customsAiInlineData, customsFileMime } from "@/lib/customs/customs-ai-input";
import { cnDescription, cnLeaves } from "@/lib/customs/cn-nomenclature";
import {
  isLegacyXls,
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
const MAX_PROPOSAL_LINES = 80;
const MAX_SHEET_FILE_SIZE = 20 * 1024 * 1024;
const LEGACY_XLS_MESSAGE =
  "Stary format .xls nie jest obsługiwany - otwórz plik w Excelu i zapisz jako .xlsx (albo CSV).";

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
 * - Excel (.xlsx) i CSV — kolumny rozpoznane po nagłówkach (PL/EN/DE), bez AI;
 *   gdy układ jest nietypowy, a AI jest włączone — AI czyta arkusz jako tekst,
 * - PDF i skany — AI (Gemini).
 */
export async function actionReadInvoiceFile(formData: FormData): Promise<ReadInvoiceFileResult> {
  await requireOperations("mutate");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Wybierz plik faktury.");
  const mime = file.type || "application/octet-stream";
  if (isLegacyXls(file.name, mime)) return fail(LEGACY_XLS_MESSAGE);

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
    return fail("Obsługiwane pliki: Excel (.xlsx), CSV, PDF i zdjęcia (JPG, PNG, TIF).");
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
  if (isLegacyXls(row.file_name, row.mime_type)) return fail(LEGACY_XLS_MESSAGE);
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

/** Kandydaci do weryfikacji: istniejące kody CN pozycji (4 cyfry), przy dużych pozycjach — podpozycji. */
function cnCandidates(proposed: string | null, invoiceHs: string | null): { code: string; text: string }[] {
  const heading = proposed?.slice(0, 4) || invoiceHs?.slice(0, 4);
  if (!heading) return [];
  let leaves = cnLeaves(heading);
  if (leaves.length > 40 && proposed) {
    const sub = cnLeaves(proposed.slice(0, 6));
    if (sub.length) leaves = sub;
  }
  return leaves.slice(0, 60);
}

/**
 * Drugi przebieg AI: kod wybrany spośród istniejących kodów CN z opisami. Bez odpowiedzi AI
 * zostaje kod z pierwszego przebiegu, o ile istnieje w CN — nieistniejący kod nigdy nie trafia do karty.
 */
async function verifyCnCodes(
  proposals: LineProposal[],
  byLine: ReadonlyMap<string, { supplierName: string; invoiceHsCode: string | null }>
): Promise<LineProposal[]> {
  const items: CnVerifyItem[] = [];
  for (const p of proposals) {
    const line = byLine.get(p.ref);
    const candidates = cnCandidates(p.cnCode, line?.invoiceHsCode ?? null);
    if (!line || !candidates.length) continue;
    items.push({
      ref: p.ref,
      supplierName: line.supplierName,
      descriptionPl: p.descriptionPl,
      material: p.material,
      proposedCnCode: p.cnCode,
      candidates,
    });
  }
  let verified = new Map<string, { cnCode: string | null; cnCertain: boolean; cnReason: string }>();
  if (items.length) {
    try {
      const raw = await callCustomsGemini([{ text: buildCnVerifyPrompt(items) }], CN_VERIFY_SCHEMA);
      const allowed = new Map(items.map((i) => [i.ref, new Set(i.candidates.map((c) => c.code))]));
      verified = new Map(parseCnVerify(raw, allowed).map((v) => [v.ref, v]));
    } catch (e) {
      console.error("[customs-ai] cn verify:", e instanceof Error ? e.message : e);
    }
  }
  return proposals.map((p) => {
    const v = verified.get(p.ref);
    const fallback = p.cnCode && cnDescription(p.cnCode) ? p.cnCode : null;
    const cnCode = v ? v.cnCode : fallback;
    return {
      ...p,
      cnCode,
      cnCertain: Boolean(cnCode) && p.cnCertain !== false && (v ? v.cnCertain : true),
      cnReason: v?.cnReason || p.cnReason || (cnCode ? undefined : "Brak pasującego kodu w CN - uzupełnij ręcznie."),
    };
  });
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
  const supabase = createAdminClient();
  const view = await loadClearanceView(supabase, id);
  if (!view) return fail("Odprawa nie istnieje.");
  if (view.status === "sent") return fail("Odprawa jest już wysłana.");

  // Bez karty, propozycja AI do odświeżenia albo niezatwierdzony opis bez kodu CN (np. z maila).
  const targets = view.lines
    .filter(
      (l) =>
        !l.card ||
        (l.card.status === "proposed" && (l.card.source === "ai" || !l.card.cnCode))
    )
    .filter((l) => l.supplierArticleCode)
    // Kilka pozycji tego samego artykułu (np. 3× „Car needle FOR engrave”) dzieli jedną kartę.
    .filter((l, i, all) => all.findIndex((o) => o.supplierArticleCode === l.supplierArticleCode) === i);
  const remaining = Math.max(0, targets.length - MAX_PROPOSAL_LINES);
  targets.splice(MAX_PROPOSAL_LINES);
  if (!targets.length) return fail("Wszystkie pozycje mają już opis i kod CN - nic do zaproponowania.");

  const { data: confirmed } = await supabase
    .from("customs_product_cards")
    .select("supplier_name, description_pl, material, cn_code")
    .eq("supplier_id", view.supplierId)
    .eq("status", "confirmed")
    .order("confirmed_at", { ascending: false })
    .limit(40);
  type ExampleRow = { supplier_name: string; description_pl: string; material: string; cn_code: string | null };
  const toExample = (c: ExampleRow): ProposalExample => ({
    supplierName: c.supplier_name,
    descriptionPl: c.description_pl,
    material: c.material,
    cnCode: c.cn_code,
  });
  const examples = ((confirmed ?? []) as ExampleRow[]).map(toExample);
  // Praktyka klasyfikacji z innych dostawców (np. frezy do frezarek → 8207 70 90).
  const { data: otherConfirmed } = await supabase
    .from("customs_product_cards")
    .select("supplier_name, description_pl, material, cn_code")
    .neq("supplier_id", view.supplierId)
    .eq("status", "confirmed")
    .order("confirmed_at", { ascending: false })
    .limit(30);
  const otherExamples = ((otherConfirmed ?? []) as ExampleRow[]).map(toExample);

  const docIds = view.documents.map((d) => d.id);
  const { data: docArticles } = docIds.length
    ? await supabase
        .from("customs_document_articles")
        .select("supplier_article_code, description")
        .in("document_id", docIds)
    : { data: [] };
  const docDescription = new Map(
    ((docArticles ?? []) as Array<{ supplier_article_code: string; description: string }>)
      .filter((a) => a.description)
      .map((a) => [a.supplier_article_code, a.description])
  );

  const requestLines: ProposalRequestLine[] = targets.map((t) => ({
    ref: t.id,
    code: t.supplierArticleCode,
    supplierName: t.supplierName,
    documentDescription: docDescription.get(t.supplierArticleCode),
    invoiceHsCode: t.invoiceHsCode,
    knownDescriptionPl: t.card && t.card.source !== "ai" ? t.card.descriptionPl || undefined : undefined,
  }));

  let proposals;
  try {
    const raw = await callCustomsGemini(
      [
        {
          text: buildLineProposalsPrompt({
            supplierName: view.supplierName,
            shipmentDescription: view.shipmentDescription,
            lines: requestLines,
            examples,
            otherExamples,
          }),
        },
      ],
      LINE_PROPOSALS_SCHEMA
    );
    proposals = parseLineProposals(raw, new Set(requestLines.map((l) => l.ref)));
  } catch (e) {
    console.error("[customs-ai] proposals:", e instanceof Error ? e.message : e);
    return fail(userFacingCustomsAiError(e));
  }

  const byLine = new Map(targets.map((t) => [t.id, t]));
  proposals = await verifyCnCodes(proposals, byLine);
  let proposed = 0;
  const uncertain: string[] = [];
  for (const p of proposals) {
    const line = byLine.get(p.ref);
    if (!line) continue;
    if (p.cnCertain === false || !p.cnCode) {
      uncertain.push(`poz. ${line.position}${p.cnReason ? ` (${p.cnReason})` : ""}`);
    }
    // Opis ustalony przez człowieka (z maila / ręcznie) zostaje — AI dokłada tylko CN i brakujący materiał.
    const kept = line.card && line.card.source !== "ai" ? line.card : null;
    const saved = await upsertCard(supabase, {
      supplierId: view.supplierId,
      code: line.supplierArticleCode,
      supplierName: line.supplierName,
      subiektTwId: null,
      clearanceId: id,
      userId: user.id,
      confirm: false,
      source: kept ? (kept.source === "copied" ? "copied" : "manual") : "ai",
      values: {
        description_pl: kept?.descriptionPl || p.descriptionPl,
        material: kept?.material || p.material,
        cn_code: p.cnCode,
        is_medical_device: line.vat.isMedicalDevice,
        vat_rate: line.vat.rate,
        vat_basis_document_id: line.vat.basisDocument?.id ?? null,
      },
    });
    if ("error" in saved) return fail(saved.error);
    await supabase
      .from("customs_clearance_lines")
      .update({ card_id: saved.id })
      .eq("clearance_id", id)
      .eq("supplier_article_code", line.supplierArticleCode);
    proposed++;
  }

  revalidatePath(`/zakupy/odprawy/${id}`);
  return { ok: true, proposed, uncertain, remaining };
}
