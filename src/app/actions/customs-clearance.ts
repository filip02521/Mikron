"use server";

// @service-role-ok — autoryzacja requireOperations(); service role z pełnym scope po warstwie aplikacji.

import { revalidatePath } from "next/cache";
import { warsawDateKeyDaysAgo } from "@/lib/time/warsaw";
import { requireOperations } from "@/lib/auth";
import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import { getSubiektZd, searchSubiektZd } from "@/lib/subiekt/api";
import { fetchSupplierSubiektKhAliases } from "@/lib/data/supplier-subiekt-kh";
import {
  extractDocKhIds,
  zdListItemMatchesSupplierKhIds,
  type SubiektZdListItem,
} from "@/lib/subiekt/zd-document-kh";
import {
  normalizeArticleCode,
  normalizeCnCode,
  type CustomsVatRate,
} from "@/lib/customs/customs-clearance";
import {
  linesFromSubiektZd,
  parseArticleCodesPaste,
  parseInvoiceLinesPaste,
  type CustomsInputLine,
} from "@/lib/customs/customs-lines";
import { isLineComplete, type CustomsClearanceView } from "@/lib/customs/customs-view";
import { buildCustomsClearanceWorkbook } from "@/lib/customs/customs-excel";
import { cleanUuid, loadClearanceView, upsertCard, type Db } from "@/lib/customs/customs-data";

const STORAGE_BUCKET = "customs-documents";
const MAX_INVOICE_SIZE = 20 * 1024 * 1024;
const VAT_RATES = new Set<number>([0, 5, 8, 23]);
const ODPRAWY_PATH = "/zakupy/odprawy";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function errorText(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

function revalidateClearance(id?: string) {
  revalidatePath(ODPRAWY_PATH);
  if (id) revalidatePath(`${ODPRAWY_PATH}/${id}`);
}


// ─── Dostawcy i ZD ─────────────────────────────────────────────────────────

export type CustomsSupplierOption = { id: string; name: string };

/** Dostawcy importowi (spoza UE) — tylko dla nich robimy odprawy. */
export async function actionListCustomsSuppliers(): Promise<CustomsSupplierOption[]> {
  await requireOperations("read");
  if (!hasSupabaseConfig()) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("location", "IMPORT")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as CustomsSupplierOption[];
}

export type CustomsZdOption = { id: number; number: string; date: string | null; total: number | null };

/** Ostatnie ZD dostawcy z Subiekta (120 dni), najnowsze pierwsze. */
export async function actionListSupplierRecentZd(
  supplierId: string
): Promise<Result<{ zds: CustomsZdOption[] }>> {
  await requireOperations("read");
  try {
    const supabase = createAdminClient();
    const { data: supplier } = await supabase
      .from("suppliers")
      .select("subiekt_kh_id")
      .eq("id", supplierId)
      .single();
    const khIds = new Set<number>();
    const primary = Number((supplier as { subiekt_kh_id?: number | null } | null)?.subiekt_kh_id);
    if (Number.isFinite(primary) && primary > 0) khIds.add(primary);
    for (const alias of await fetchSupplierSubiektKhAliases(supplierId)) khIds.add(alias.subiektKhId);
    if (!khIds.size) {
      return fail("Dostawca nie ma przypisanego kontrahenta z Subiekta — wybierz ZD ręcznie (numer ID) albo wklej pozycje faktury.");
    }

    const zds: CustomsZdOption[] = [];
    for (let page = 1; page <= 6; page++) {
      const res = await searchSubiektZd({
        dataOd: warsawDateKeyDaysAgo(120),
        dataDo: warsawDateKeyDaysAgo(-1),
        page,
        pageSize: 200,
      });
      for (const item of res.data) {
        if (!zdListItemMatchesSupplierKhIds(item as SubiektZdListItem, [...khIds])) continue;
        zds.push({
          id: item.dok_Id,
          number: item.dok_NrPelny ?? `ZD ${item.dok_Id}`,
          date: item.dok_DataWyst?.slice(0, 10) ?? null,
          total: item.dok_WartNetto ?? null,
        });
      }
      if (!res.pagination || page >= res.pagination.totalPages) break;
    }
    zds.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || b.id - a.id);
    return { ok: true, zds };
  } catch (e) {
    return fail(`Nie udało się pobrać ZD z Subiekta: ${errorText(e, "brak połączenia")}`);
  }
}

// ─── Lista odpraw ──────────────────────────────────────────────────────────

export type CustomsClearanceListItem = {
  id: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string | null;
  zdNumber: string | null;
  status: "draft" | "sent";
  createdAt: string;
  sentAt: string | null;
  lineCount: number;
};

export async function actionListCustomsClearances(): Promise<CustomsClearanceListItem[]> {
  await requireOperations("read");
  if (!hasSupabaseConfig()) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("customs_clearances")
    .select("id, supplier_id, invoice_number, invoice_date, zd_number, status, created_at, sent_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{
    id: string;
    supplier_id: string;
    invoice_number: string;
    invoice_date: string | null;
    zd_number: string | null;
    status: "draft" | "sent";
    created_at: string;
    sent_at: string | null;
  }>;
  if (!rows.length) return [];

  const supplierIds = [...new Set(rows.map((r) => r.supplier_id))];
  const { data: suppliers } = await supabase.from("suppliers").select("id, name").in("id", supplierIds);
  const names = new Map((suppliers ?? []).map((s) => [(s as { id: string }).id, (s as { name: string }).name]));

  const { data: lineRows } = await supabase
    .from("customs_clearance_lines")
    .select("clearance_id")
    .in("clearance_id", rows.map((r) => r.id));
  const counts = new Map<string, number>();
  for (const l of (lineRows ?? []) as Array<{ clearance_id: string }>) {
    counts.set(l.clearance_id, (counts.get(l.clearance_id) ?? 0) + 1);
  }

  return rows.map((r) => ({
    id: r.id,
    supplierName: names.get(r.supplier_id) ?? "—",
    invoiceNumber: r.invoice_number,
    invoiceDate: r.invoice_date,
    zdNumber: r.zd_number,
    status: r.status,
    createdAt: r.created_at,
    sentAt: r.sent_at,
    lineCount: counts.get(r.id) ?? 0,
  }));
}

// ─── Tworzenie ─────────────────────────────────────────────────────────────

export type CreateCustomsClearanceInput = {
  supplierId: string;
  invoiceNumber: string;
  invoiceDate: string | null;
  currency: string;
  shipmentDescription: string;
  zdId: number | null;
  pastedLines: string;
  /** Z odczytu faktury przez AI (opcjonalnie). */
  invoiceTotal?: number | null;
  invoiceHsCode?: string | null;
  countryOfOrigin?: string | null;
};

async function lastShipmentDescription(supabase: Db, supplierId: string): Promise<string> {
  const { data } = await supabase
    .from("customs_clearances")
    .select("shipment_description")
    .eq("supplier_id", supplierId)
    .neq("shipment_description", "")
    .order("created_at", { ascending: false })
    .limit(1);
  return ((data ?? [])[0] as { shipment_description?: string } | undefined)?.shipment_description ?? "";
}

export async function actionCreateCustomsClearance(
  input: CreateCustomsClearanceInput
): Promise<Result<{ id: string; warnings: string[] }>> {
  const user = await requireOperations("mutate");
  if (!hasSupabaseConfig()) return fail("Brak konfiguracji bazy.");
  const supplierId = cleanUuid(input.supplierId);
  if (!supplierId) return fail("Wybierz dostawcę.");
  const supabase = createAdminClient();

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id, location, subiekt_kh_id")
    .eq("id", supplierId)
    .single();
  if (!supplier) return fail("Wybierz dostawcę.");
  if ((supplier as { location: string }).location !== "IMPORT") {
    return fail("Odprawy robimy tylko dla dostawców typu Import.");
  }

  const warnings: string[] = [];
  let lines: CustomsInputLine[] = [];
  let zdNumber: string | null = null;
  let zdLines: CustomsInputLine[] = [];

  if (input.zdId) {
    try {
      const doc = await getSubiektZd(input.zdId);
      const khIds = new Set<number>();
      const primary = Number((supplier as { subiekt_kh_id?: number | null }).subiekt_kh_id);
      if (Number.isFinite(primary) && primary > 0) khIds.add(primary);
      for (const alias of await fetchSupplierSubiektKhAliases(supplierId)) khIds.add(alias.subiektKhId);
      if (khIds.size && !extractDocKhIds(doc).some((id) => khIds.has(id))) {
        return fail(`${doc.dok_NrPelny ?? "To ZD"} nie należy do wybranego dostawcy.`);
      }
      zdNumber = doc.dok_NrPelny ?? `ZD ${doc.dok_Id}`;
      zdLines = linesFromSubiektZd(doc);
    } catch (e) {
      return fail(`Nie udało się wczytać ZD z Subiekta: ${errorText(e, "brak połączenia")}`);
    }
  }

  if (input.pastedLines.trim()) {
    const parsed = parseInvoiceLinesPaste(input.pastedLines);
    warnings.push(...parsed.errors);
    lines = parsed.lines;
  } else {
    lines = zdLines;
  }
  if (!lines.length) return fail("Brak pozycji — wybierz ZD albo wklej pozycje faktury.");

  const zdQtyByCode = new Map<string, number>();
  for (const l of zdLines) {
    zdQtyByCode.set(l.supplierArticleCode, (zdQtyByCode.get(l.supplierArticleCode) ?? 0) + l.quantity);
  }

  const shipmentDescription =
    input.shipmentDescription.trim() || (await lastShipmentDescription(supabase, supplierId));

  const { data: created, error } = await supabase
    .from("customs_clearances")
    .insert({
      supplier_id: supplierId,
      subiekt_zd_id: input.zdId,
      zd_number: zdNumber,
      invoice_number: input.invoiceNumber.trim().slice(0, 120),
      invoice_date: input.invoiceDate || null,
      currency: (input.currency.trim() || "EUR").toUpperCase().slice(0, 3),
      shipment_description: shipmentDescription.slice(0, 300),
      invoice_total: Number.isFinite(input.invoiceTotal) ? input.invoiceTotal : null,
      invoice_hs_code: input.invoiceHsCode?.trim().slice(0, 40) || null,
      country_of_origin: input.countryOfOrigin?.trim().slice(0, 80) || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !created) return fail(error?.message ?? "Nie udało się utworzyć odprawy.");
  const clearanceId = (created as { id: string }).id;

  const { error: linesError } = await supabase.from("customs_clearance_lines").insert(
    lines.map((l, i) => ({
      clearance_id: clearanceId,
      position: i + 1,
      supplier_article_code: l.supplierArticleCode,
      supplier_name: l.supplierName.slice(0, 500),
      quantity: l.quantity,
      unit_price: l.unitPrice,
      amount: l.unitPrice != null ? Math.round(l.unitPrice * l.quantity * 100) / 100 : null,
      subiekt_tw_id: l.subiektTwId,
      zd_quantity: input.zdId ? zdQtyByCode.get(l.supplierArticleCode) ?? 0 : null,
    }))
  );
  if (linesError) {
    await supabase.from("customs_clearances").delete().eq("id", clearanceId);
    return fail(linesError.message);
  }

  revalidateClearance();
  return { ok: true, id: clearanceId, warnings };
}

// ─── Widok ─────────────────────────────────────────────────────────────────

export async function actionGetCustomsClearance(id: string): Promise<CustomsClearanceView | null> {
  await requireOperations("read");
  if (!hasSupabaseConfig()) return null;
  return loadClearanceView(createAdminClient(), id);
}

// ─── Edycja ────────────────────────────────────────────────────────────────

export async function actionUpdateCustomsClearanceHeader(
  id: string,
  patch: { invoiceNumber: string; invoiceDate: string | null; currency: string; shipmentDescription: string }
): Promise<Result> {
  await requireOperations("mutate");
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("customs_clearances")
    .update({
      invoice_number: patch.invoiceNumber.trim().slice(0, 120),
      invoice_date: patch.invoiceDate || null,
      currency: (patch.currency.trim() || "EUR").toUpperCase().slice(0, 3),
      shipment_description: patch.shipmentDescription.trim().slice(0, 300),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return fail(error.message);
  revalidateClearance(id);
  return { ok: true };
}

export type SaveCustomsLineInput = {
  lineId: string;
  supplierArticleCode: string;
  descriptionPl: string;
  material: string;
  cnCode: string;
  isMedicalDevice: boolean;
  vatRate: number;
  vatBasisDocumentId: string | null;
  confirm: boolean;
};

export async function actionSaveCustomsLine(input: SaveCustomsLineInput): Promise<Result> {
  const user = await requireOperations("mutate");
  const lineId = cleanUuid(input.lineId);
  if (!lineId) return fail("Pozycja nie istnieje.");
  const supabase = createAdminClient();

  const { data: line } = await supabase
    .from("customs_clearance_lines")
    .select("id, clearance_id, supplier_article_code, supplier_name, subiekt_tw_id")
    .eq("id", lineId)
    .single();
  if (!line) return fail("Pozycja nie istnieje.");
  const l = line as {
    id: string;
    clearance_id: string;
    supplier_article_code: string;
    supplier_name: string;
    subiekt_tw_id: number | null;
  };
  const { data: clearance } = await supabase
    .from("customs_clearances")
    .select("supplier_id, status")
    .eq("id", l.clearance_id)
    .single();
  if (!clearance) return fail("Odprawa nie istnieje.");
  const c = clearance as { supplier_id: string; status: string };

  const code = normalizeArticleCode(input.supplierArticleCode) || normalizeArticleCode(l.supplier_name).slice(0, 120);
  if (!code) return fail("Podaj kod artykułu dostawcy.");
  const cnRaw = input.cnCode.trim();
  const cn = normalizeCnCode(cnRaw);
  if (cnRaw && !cn) return fail("Kod CN musi mieć 8 cyfr (np. 90184900).");
  if (input.confirm && (!input.descriptionPl.trim() || !cn)) {
    return fail("Do zatwierdzenia potrzebny jest opis PL i kod CN.");
  }
  if (!VAT_RATES.has(input.vatRate)) return fail("Nieprawidłowa stawka VAT.");

  if (code !== l.supplier_article_code) {
    const { error } = await supabase
      .from("customs_clearance_lines")
      .update({ supplier_article_code: code })
      .eq("id", l.id);
    if (error) return fail(error.message);
  }

  const saved = await upsertCard(supabase, {
    supplierId: c.supplier_id,
    code,
    supplierName: l.supplier_name,
    subiektTwId: l.subiekt_tw_id,
    clearanceId: l.clearance_id,
    userId: user.id,
    confirm: input.confirm,
    values: {
      description_pl: input.descriptionPl.trim().slice(0, 500),
      material: input.material.trim().slice(0, 300),
      cn_code: cn,
      is_medical_device: input.isMedicalDevice,
      vat_rate: input.vatRate as CustomsVatRate,
      vat_basis_document_id: input.vatRate === 8 ? input.vatBasisDocumentId : null,
    },
  });
  if ("error" in saved) return fail(saved.error);
  await supabase.from("customs_clearance_lines").update({ card_id: saved.id }).eq("id", l.id);

  revalidateClearance(l.clearance_id);
  return { ok: true };
}

/** Zatwierdza wszystkie kompletne propozycje (opis PL + CN) w odprawie. */
export async function actionConfirmAllCustomsLines(clearanceId: string): Promise<Result<{ confirmed: number }>> {
  const user = await requireOperations("mutate");
  const supabase = createAdminClient();
  const view = await loadClearanceView(supabase, clearanceId);
  if (!view) return fail("Odprawa nie istnieje.");
  let confirmed = 0;
  for (const line of view.lines) {
    if (!line.card || line.card.status === "confirmed" || !isLineComplete(line)) continue;
    const res = await upsertCard(supabase, {
      supplierId: view.supplierId,
      code: line.supplierArticleCode,
      supplierName: line.supplierName,
      subiektTwId: null,
      clearanceId,
      userId: user.id,
      confirm: true,
      values: {
        description_pl: line.card.descriptionPl,
        material: line.card.material,
        cn_code: line.card.cnCode,
        is_medical_device: line.vat.isMedicalDevice,
        vat_rate: line.vat.rate,
        vat_basis_document_id: line.vat.basisDocument?.id ?? null,
      },
    });
    if ("error" in res) return fail(res.error);
    confirmed++;
  }
  revalidateClearance(clearanceId);
  return { ok: true, confirmed };
}

/** Lista artykułów z dokumentu dostawcy (np. Annex A deklaracji) — zastępuje wpisy ręczne. */
export async function actionSetCustomsDocumentArticles(
  documentId: string,
  text: string,
  clearanceId?: string
): Promise<Result<{ count: number }>> {
  await requireOperations("mutate");
  const supabase = createAdminClient();
  const { data: doc } = await supabase
    .from("supplier_customs_documents")
    .select("id")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) return fail("Dokument nie istnieje.");

  const articles = parseArticleCodesPaste(text).slice(0, 2000);
  const { error: delError } = await supabase
    .from("customs_document_articles")
    .delete()
    .eq("document_id", documentId)
    .eq("source", "manual");
  if (delError) return fail(delError.message);
  if (articles.length) {
    const { error } = await supabase.from("customs_document_articles").upsert(
      articles.map((a) => ({
        document_id: documentId,
        supplier_article_code: a.code,
        description: a.description,
        source: "manual",
      })),
      { onConflict: "document_id,supplier_article_code" }
    );
    if (error) return fail(error.message);
  }
  revalidateClearance(clearanceId);
  return { ok: true, count: articles.length };
}

// ─── Faktura, załączniki, Excel, wysyłka ───────────────────────────────────

export async function actionUploadCustomsInvoice(clearanceId: string, formData: FormData): Promise<Result> {
  await requireOperations("mutate");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Wybierz plik faktury.");
  if (file.size > MAX_INVOICE_SIZE) return fail("Plik przekracza 20 MB.");
  const mime = file.type || "application/octet-stream";
  if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(mime)) {
    return fail("Faktura musi być PDF albo zdjęciem.");
  }
  const supabase = createAdminClient();
  const { data: c } = await supabase
    .from("customs_clearances")
    .select("id, invoice_storage_path")
    .eq("id", clearanceId)
    .single();
  if (!c) return fail("Odprawa nie istnieje.");

  const { randomUUID } = await import("crypto");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
  const storagePath = `customs-documents/clearances/${clearanceId}/${randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, await file.arrayBuffer(), { contentType: mime, upsert: false });
  if (upErr) return fail("Nie udało się wgrać faktury.");

  const { error } = await supabase
    .from("customs_clearances")
    .update({
      invoice_storage_path: storagePath,
      invoice_file_name: file.name.slice(0, 255),
      updated_at: new Date().toISOString(),
    })
    .eq("id", clearanceId);
  if (error) {
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]).catch(() => {});
    return fail(error.message);
  }
  const old = (c as { invoice_storage_path: string | null }).invoice_storage_path;
  if (old) await supabase.storage.from(STORAGE_BUCKET).remove([old]).catch(() => {});
  revalidateClearance(clearanceId);
  return { ok: true };
}

export async function actionGetCustomsInvoiceUrl(clearanceId: string): Promise<Result<{ url: string }>> {
  const user = await requireOperations("read");
  const supabase = createAdminClient();
  const { data: c } = await supabase
    .from("customs_clearances")
    .select("invoice_storage_path")
    .eq("id", clearanceId)
    .single();
  const path = (c as { invoice_storage_path?: string | null } | null)?.invoice_storage_path;
  if (!path) return fail("Brak faktury.");
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(path, 3600, user.id);
  if (error || !data?.signedUrl) return fail("Nie udało się przygotować pobierania.");
  return { ok: true, url: data.signedUrl };
}

export async function actionExportCustomsExcel(
  clearanceId: string
): Promise<Result<{ base64: string; fileName: string }>> {
  await requireOperations("read");
  const view = await loadClearanceView(createAdminClient(), clearanceId);
  if (!view) return fail("Odprawa nie istnieje.");
  const buffer = await buildCustomsClearanceWorkbook(view);
  const safe = (view.invoiceNumber || view.id.slice(0, 8)).replace(/[^\p{L}\p{N}._-]+/gu, "_");
  return { ok: true, base64: buffer.toString("base64"), fileName: `odprawa_${safe}.xlsx` };
}

export async function actionMarkCustomsClearanceSent(clearanceId: string): Promise<Result> {
  await requireOperations("mutate");
  const supabase = createAdminClient();
  const view = await loadClearanceView(supabase, clearanceId);
  if (!view) return fail("Odprawa nie istnieje.");
  if (view.incompleteCount > 0) {
    return fail(`Uzupełnij opis PL i kod CN w ${view.incompleteCount} pozycjach przed wysyłką.`);
  }
  const now = new Date().toISOString();
  for (const line of view.lines) {
    await supabase
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
  }
  const { error } = await supabase
    .from("customs_clearances")
    .update({ status: "sent", sent_at: now, email_text: view.emailText, updated_at: now })
    .eq("id", clearanceId);
  if (error) return fail(error.message);
  revalidateClearance(clearanceId);
  return { ok: true };
}

export async function actionDeleteCustomsClearance(clearanceId: string): Promise<Result> {
  await requireOperations("mutate");
  const supabase = createAdminClient();
  const { data: c } = await supabase
    .from("customs_clearances")
    .select("status, invoice_storage_path")
    .eq("id", clearanceId)
    .single();
  if (!c) return fail("Odprawa nie istnieje.");
  const row = c as { status: string; invoice_storage_path: string | null };
  if (row.status === "sent") return fail("Wysłanej odprawy nie można usunąć.");
  const { error } = await supabase.from("customs_clearances").delete().eq("id", clearanceId);
  if (error) return fail(error.message);
  if (row.invoice_storage_path) {
    await supabase.storage.from(STORAGE_BUCKET).remove([row.invoice_storage_path]).catch(() => {});
  }
  revalidateClearance();
  return { ok: true };
}
