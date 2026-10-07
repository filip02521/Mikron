/**
 * Propozycje opisu PL / materiału / kodu CN dla pozycji odprawy (Gemini) — rdzeń bez autoryzacji,
 * wspólny dla przycisku w odprawie i automatu z maili DHL. Kod CN zawsze sprawdzany w nomenklaturze.
 */

import {
  CN_VERIFY_SCHEMA,
  LINE_PROPOSALS_SCHEMA,
  buildCnVerifyPrompt,
  buildLineProposalsPrompt,
  callCustomsGemini,
  parseCnVerify,
  parseLineProposals,
  userFacingCustomsAiError,
  type CnVerifyItem,
  type LineProposal,
  type ProposalExample,
  type ProposalRequestLine,
} from "@/lib/customs/customs-ai";
import { loadClearanceView, upsertCard } from "@/lib/customs/customs-data";
import { cnDescription, cnLeaves } from "@/lib/customs/cn-nomenclature";
import type { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

export const MAX_PROPOSAL_LINES = 80;

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
export async function proposeCustomsLines(
  supabase: Db,
  id: string,
  userId: string
): Promise<Result<{ proposed: number; uncertain: string[]; remaining: number }>> {
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
    invoiceGroup: t.invoiceGroup,
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
      userId,
      confirm: false,
      source: kept ? (kept.source === "copied" ? "copied" : "manual") : "ai",
      values: {
        description_pl: kept?.descriptionPl || p.descriptionPl,
        material: kept?.material || p.material,
        cn_code: p.cnCode,
        // Karta człowieka zachowuje swoją stawkę (albo jej brak) — nie utrwalamy stawki wyliczonej
        // z dokumentów, bo „copied” / „manual” wygrywa potem z deklaracją dostawcy.
        is_medical_device: kept ? kept.isMedicalDevice : line.vat.isMedicalDevice,
        vat_rate: kept ? kept.vatRate : line.vat.rate,
        vat_basis_document_id: kept ? kept.vatBasisDocumentId : (line.vat.basisDocument?.id ?? null),
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

  return { ok: true, proposed, uncertain, remaining };
}
