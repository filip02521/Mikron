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
  LINE_PROPOSALS_SCHEMA,
  buildLineProposalsPrompt,
  callCustomsGemini,
  documentArticlesToPasteText,
  invoiceLinesToPasteText,
  isCustomsAiConfigured,
  parseDocumentArticlesExtraction,
  parseInvoiceExtraction,
  parseLineProposals,
  userFacingCustomsAiError,
  type InvoiceExtraction,
  type ProposalExample,
  type ProposalRequestLine,
} from "@/lib/customs/customs-ai";
import { cleanUuid, loadClearanceView, upsertCard } from "@/lib/customs/customs-data";

const AI_MIME = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
/** Limit inline danych w zapytaniu Gemini (~20 MB z narzutem base64). */
const MAX_AI_FILE_SIZE = 14 * 1024 * 1024;
const MAX_PROPOSAL_LINES = 80;

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
  const mime = file.type || "application/octet-stream";
  if (!AI_MIME.has(mime)) return fail("Faktura musi być PDF albo zdjęciem.");
  try {
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");
    const raw = await callCustomsGemini(
      [{ inlineData: { data, mimeType: mime } }, { text: INVOICE_EXTRACTION_PROMPT }],
      INVOICE_EXTRACTION_SCHEMA
    );
    const invoice = parseInvoiceExtraction(raw);
    if (!invoice.lines.length) return fail("AI nie znalazło pozycji na fakturze — wklej je ręcznie.");
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
    .select("storage_path, mime_type, byte_size")
    .eq("id", id)
    .maybeSingle();
  if (!doc) return fail("Dokument nie istnieje.");
  const row = doc as { storage_path: string; mime_type: string; byte_size: number | null };
  if (!AI_MIME.has(row.mime_type)) return fail("AI czyta tylko PDF i zdjęcia.");
  if ((row.byte_size ?? 0) > MAX_AI_FILE_SIZE) return fail("Plik za duży dla AI (maks. 14 MB).");
  try {
    const bytes = await readStorageObject(row.storage_path);
    const raw = await callCustomsGemini(
      [{ inlineData: { data: bytes.toString("base64"), mimeType: row.mime_type } }, { text: DOCUMENT_ARTICLES_PROMPT }],
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
): Promise<Result<{ proposed: number }>> {
  const user = await requireOperations("mutate");
  const id = cleanUuid(clearanceId);
  if (!id) return fail("Odprawa nie istnieje.");
  const supabase = createAdminClient();
  const view = await loadClearanceView(supabase, id);
  if (!view) return fail("Odprawa nie istnieje.");
  if (view.status === "sent") return fail("Odprawa jest już wysłana.");

  const targets = view.lines
    .filter((l) => !l.card || (l.card.status === "proposed" && l.card.source === "ai"))
    .filter((l) => l.supplierArticleCode)
    .slice(0, MAX_PROPOSAL_LINES);
  if (!targets.length) return fail("Wszystkie pozycje mają już opis — nic do zaproponowania.");

  const { data: confirmed } = await supabase
    .from("customs_product_cards")
    .select("supplier_name, description_pl, material, cn_code")
    .eq("supplier_id", view.supplierId)
    .eq("status", "confirmed")
    .order("confirmed_at", { ascending: false })
    .limit(40);
  const examples: ProposalExample[] = (
    (confirmed ?? []) as Array<{ supplier_name: string; description_pl: string; material: string; cn_code: string | null }>
  ).map((c) => ({ supplierName: c.supplier_name, descriptionPl: c.description_pl, material: c.material, cnCode: c.cn_code }));

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
  let proposed = 0;
  for (const p of proposals) {
    const line = byLine.get(p.ref);
    if (!line) continue;
    const saved = await upsertCard(supabase, {
      supplierId: view.supplierId,
      code: line.supplierArticleCode,
      supplierName: line.supplierName,
      subiektTwId: null,
      clearanceId: id,
      userId: user.id,
      confirm: false,
      source: "ai",
      values: {
        description_pl: p.descriptionPl,
        material: p.material,
        cn_code: p.cnCode,
        is_medical_device: line.vat.isMedicalDevice,
        vat_rate: line.vat.rate,
        vat_basis_document_id: line.vat.basisDocument?.id ?? null,
      },
    });
    if ("error" in saved) return fail(saved.error);
    await supabase.from("customs_clearance_lines").update({ card_id: saved.id }).eq("id", line.id);
    proposed++;
  }

  revalidatePath(`/zakupy/odprawy/${id}`);
  return { ok: true, proposed };
}
