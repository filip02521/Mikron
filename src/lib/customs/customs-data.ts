// @service-role-ok — wywoływane wyłącznie z akcji po requireOperations().

import { createAdminClient } from "@/lib/supabase/admin";
import { createCnLookup } from "./cn-nomenclature";
import {
  buildDocumentArticleIndex,
  normalizeArticleCode,
  type CustomsDocumentRef,
} from "./customs-clearance";
import {
  buildCustomsClearanceSummary,
  buildCustomsLineViews,
  lineArticleKey,
  type CustomsCardRow,
  type CustomsClearanceView,
  type CustomsLineRow,
} from "./customs-view";

export type Db = ReturnType<typeof createAdminClient>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Identyfikator z klienta — przycięty i sprawdzony jako UUID (inaczej null). */
export function cleanUuid(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  return UUID_RE.test(v) ? v : null;
}

export async function loadSupplierDocuments(supabase: Db, supplierId: string) {
  const { data: docs } = await supabase
    .from("supplier_customs_documents")
    .select("id, file_name, description")
    .eq("supplier_id", supplierId)
    .order("created_at", { ascending: false });
  const documents = ((docs ?? []) as Array<{ id: string; file_name: string; description: string }>).map(
    (d): CustomsDocumentRef => ({ id: d.id, fileName: d.file_name, description: d.description })
  );
  const articles = documents.length
    ? (((
        await supabase
          .from("customs_document_articles")
          .select("document_id, supplier_article_code")
          .in("document_id", documents.map((d) => d.id))
      ).data ?? []) as Array<{ document_id: string; supplier_article_code: string }>)
    : [];
  const byId = new Map(documents.map((d) => [d.id, d]));
  const index = buildDocumentArticleIndex(
    articles
      .filter((a) => byId.has(a.document_id))
      .map((a) => ({ supplierArticleCode: a.supplier_article_code, document: byId.get(a.document_id)! }))
  );
  const codesByDoc = new Map<string, string[]>();
  for (const a of articles) {
    const list = codesByDoc.get(a.document_id) ?? [];
    list.push(a.supplier_article_code);
    codesByDoc.set(a.document_id, list);
  }
  return {
    index,
    documents: documents.map((d) => ({ ...d, articleCodes: (codesByDoc.get(d.id) ?? []).sort() })),
  };
}

export async function loadClearanceView(supabase: Db, id: string): Promise<CustomsClearanceView | null> {
  const { data: c } = await supabase
    .from("customs_clearances")
    .select(
      "id, supplier_id, zd_number, invoice_number, invoice_date, currency, shipment_description, invoice_file_name, invoice_storage_path, status, sent_at, email_text, agency_email"
    )
    .eq("id", id)
    .maybeSingle();
  if (!c) return null;
  const clearance = c as {
    id: string;
    supplier_id: string;
    zd_number: string | null;
    invoice_number: string;
    invoice_date: string | null;
    currency: string;
    shipment_description: string;
    invoice_file_name: string | null;
    status: "draft" | "sent";
    sent_at: string | null;
    email_text: string | null;
    invoice_storage_path: string | null;
    agency_email: string | null;
  };

  const [{ data: supplier }, { data: lineRows }, docs, { data: lastAgency }] = await Promise.all([
    supabase.from("suppliers").select("name").eq("id", clearance.supplier_id).single(),
    supabase
      .from("customs_clearance_lines")
      // „*” zamiast listy: invoice_hs_code (migracja 160) nie wywraca widoku przed migracją.
      .select("*")
      .eq("clearance_id", id)
      .order("position", { ascending: true }),
    loadSupplierDocuments(supabase, clearance.supplier_id),
    // Domyślny adres agencji = ostatnio użyty przy dowolnej odprawie.
    supabase
      .from("customs_clearances")
      .select("agency_email")
      .eq("status", "sent")
      .neq("agency_email", "")
      .order("sent_at", { ascending: false })
      .limit(1),
  ]);

  const lines = (lineRows ?? []) as CustomsLineRow[];
  const codes = [...new Set(lines.map(lineArticleKey).filter(Boolean))];
  const cardsByCode = new Map<string, CustomsCardRow>();
  if (codes.length) {
    const { data: cards } = await supabase
      .from("customs_product_cards")
      .select(
        "id, supplier_article_code, description_pl, material, cn_code, is_medical_device, vat_rate, vat_basis_document_id, status, source, confirmed_at"
      )
      .eq("supplier_id", clearance.supplier_id)
      .in("supplier_article_code", codes);
    for (const card of (cards ?? []) as CustomsCardRow[]) cardsByCode.set(card.supplier_article_code, card);
  }

  const lineViews = buildCustomsLineViews({ lines, cardsByCode, documentIndex: docs.index, cn: createCnLookup() });
  return {
    id: clearance.id,
    supplierId: clearance.supplier_id,
    supplierName: (supplier as { name?: string } | null)?.name ?? "—",
    zdNumber: clearance.zd_number,
    invoiceNumber: clearance.invoice_number,
    invoiceDate: clearance.invoice_date,
    currency: clearance.currency,
    shipmentDescription: clearance.shipment_description,
    invoiceFileName: clearance.invoice_file_name,
    status: clearance.status,
    sentAt: clearance.sent_at,
    sentEmailText: clearance.email_text,
    hasInvoiceFile: Boolean(clearance.invoice_storage_path),
    agencyEmail: clearance.agency_email,
    defaultAgencyEmail:
      clearance.agency_email ??
      (((lastAgency ?? [])[0] as { agency_email?: string | null } | undefined)?.agency_email ?? null),
    lines: lineViews,
    documents: docs.documents,
    ...buildCustomsClearanceSummary({ lines: lineViews, shipmentDescription: clearance.shipment_description }),
  };
}

export type CardWrite = {
  description_pl: string;
  material: string;
  cn_code: string | null;
  is_medical_device: boolean;
  vat_rate: number;
  vat_basis_document_id: string | null;
};

export async function upsertCard(
  supabase: Db,
  input: {
    supplierId: string;
    code: string;
    supplierName: string;
    subiektTwId: number | null;
    clearanceId: string;
    userId: string;
    values: CardWrite;
    confirm: boolean;
    /**
     * „ai” = propozycja AI, „copied” = z wcześniejszego maila do agencji — obie nie nadpisują
     * stawki z dokumentów dostawcy; domyślnie ręcznie.
     */
    source?: "manual" | "ai" | "copied";
  }
): Promise<{ id: string } | { error: string }> {
  const now = new Date().toISOString();
  const supplierId = cleanUuid(input.supplierId);
  const code = normalizeArticleCode(input.code);
  if (!supplierId || !code) return { error: "Brak dostawcy lub kodu artykułu." };
  const { data: existing } = await supabase
    .from("customs_product_cards")
    .select("id, description_pl, material, cn_code, is_medical_device, vat_rate, vat_basis_document_id, status")
    .eq("supplier_id", supplierId)
    .eq("supplier_article_code", code)
    .maybeSingle();

  const before = existing as (CardWrite & { id: string; status: string }) | null;
  const unchanged =
    before != null &&
    (Object.keys(input.values) as (keyof CardWrite)[]).every((k) => before[k] === input.values[k]);
  // Edycja bez zatwierdzenia cofa kartę do propozycji; bez zmian status zostaje.
  const status = input.confirm ? "confirmed" : unchanged && before ? before.status : "proposed";

  const row = {
    supplier_id: supplierId,
    supplier_article_code: code,
    supplier_name: input.supplierName.slice(0, 500),
    // null = nie znamy towaru w Subiekcie; nie kasuj wcześniej zapisanego powiązania.
    subiekt_tw_id: input.subiektTwId ?? undefined,
    ...input.values,
    status,
    source: input.source ?? "manual",
    confirmed_by: status === "confirmed" ? (input.confirm ? input.userId : undefined) : null,
    confirmed_at: status === "confirmed" ? (input.confirm ? now : undefined) : null,
    last_clearance_id: input.clearanceId,
    updated_at: now,
  };
  const cleanRow = Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined));

  const res = before
    ? await supabase.from("customs_product_cards").update(cleanRow).eq("id", before.id).select("id").single()
    : await supabase.from("customs_product_cards").insert(cleanRow).select("id").single();
  if (res.error || !res.data) return { error: res.error?.message ?? "Nie udało się zapisać karty." };
  const cardId = (res.data as { id: string }).id;

  const action = !before ? "created" : input.confirm ? "confirmed" : unchanged ? null : "updated";
  if (action) {
    await supabase.from("customs_product_card_events").insert({
      card_id: cardId,
      clearance_id: input.clearanceId,
      action,
      changed_by: input.userId,
      before: before ? { ...before, id: undefined } : null,
      after: { ...input.values, status },
    });
  }
  return { id: cardId };
}

/**
 * Zamyka odprawę jako wysłaną: migawka wartości każdej pozycji (historia nie zmienia się
 * po późniejszej edycji kart) + treść maila. Zwraca komunikat błędu albo null.
 */
export async function markClearanceSent(
  supabase: Db,
  view: CustomsClearanceView,
  extra: { agencyEmail?: string | null; messageId?: string | null }
): Promise<string | null> {
  const now = new Date().toISOString();
  for (const line of view.lines) {
    const { error } = await supabase
      .from("customs_clearance_lines")
      .update({
        sent_snapshot: {
          descriptionPl: line.card?.descriptionPl,
          material: line.card?.material,
          cnCode: line.card?.cnCode,
          isMedicalDevice: line.vat.isMedicalDevice,
          vatRate: line.vat.rate,
          basisDocumentId: line.vat.basisDocument?.id ?? null,
        },
      })
      .eq("id", line.id);
    if (error) return error.message;
  }
  const { error } = await supabase
    .from("customs_clearances")
    .update({
      status: "sent",
      sent_at: now,
      email_text: view.emailText,
      agency_email: extra.agencyEmail ?? null,
      sent_message_id: extra.messageId ?? null,
      updated_at: now,
    })
    .eq("id", view.id);
  return error ? error.message : null;
}
