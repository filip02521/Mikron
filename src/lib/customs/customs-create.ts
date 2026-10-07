// Tworzenie odprawy celnej: dostawca Import, pozycje z ZD albo z faktury.

import { getSubiektZd } from "@/lib/subiekt/api";
import { fetchSupplierSubiektKhAliases } from "@/lib/data/supplier-subiekt-kh";
import { extractDocKhIds } from "@/lib/subiekt/zd-document-kh";
import { customsArticleKey } from "./customs-clearance";
import { linesFromSubiektZd, parseInvoiceLinesPaste, type CustomsInputLine } from "./customs-lines";
import { cleanUuid, type Db } from "./customs-data";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function errorText(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

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

/** Rdzeń tworzenia odprawy — wołany z formularza i z automatu maili DHL (autoryzacja po stronie wołającego). */
export async function createCustomsClearance(
  supabase: Db,
  input: CreateCustomsClearanceInput,
  userId: string | null
): Promise<Result<{ id: string; warnings: string[] }>> {
  const supplierId = cleanUuid(input.supplierId);
  if (!supplierId) return fail("Wybierz dostawcę.");

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
      console.error("[customs] ZD z Subiekta:", errorText(e, "brak połączenia"));
      return fail("Subiekt jest niedostępny - nie wczytano ZD. Odznacz ZD i wgraj plik faktury albo wklej pozycje.");
    }
  }

  if (input.pastedLines.trim()) {
    const parsed = parseInvoiceLinesPaste(input.pastedLines);
    warnings.push(...parsed.errors);
    lines = parsed.lines;
  } else {
    lines = zdLines;
  }
  if (!lines.length) return fail("Brak pozycji - wybierz ZD albo wklej pozycje faktury.");

  // Klucz karty: kod z faktury, a bez kodu — nazwa (UP3D, PioCreat, Saeshin „105L(BL):COLLET CHUCK”).
  const keyOf = (l: CustomsInputLine) => customsArticleKey(l.supplierArticleCode, l.supplierName);
  const zdQtyByCode = new Map<string, number>();
  for (const l of zdLines) {
    zdQtyByCode.set(keyOf(l), (zdQtyByCode.get(keyOf(l)) ?? 0) + l.quantity);
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
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !created) return fail(error?.message ?? "Nie udało się utworzyć odprawy.");
  const clearanceId = (created as { id: string }).id;

  const { error: linesError } = await supabase.from("customs_clearance_lines").insert(
    lines.map((l, i) => ({
      clearance_id: clearanceId,
      position: i + 1,
      supplier_article_code: keyOf(l),
      supplier_name: l.supplierName.slice(0, 500),
      quantity: l.quantity,
      unit_price: l.unitPrice,
      amount: l.unitPrice != null ? Math.round(l.unitPrice * l.quantity * 100) / 100 : null,
      subiekt_tw_id: l.subiektTwId,
      // Kolumna z migracji 160 — wysyłana tylko, gdy faktura ma HS przy pozycjach.
      ...(l.invoiceHsCode ? { invoice_hs_code: l.invoiceHsCode } : {}),
      ...(l.invoiceGroup ? { invoice_group: l.invoiceGroup } : {}),
      zd_quantity: input.zdId ? zdQtyByCode.get(keyOf(l)) ?? 0 : null,
    }))
  );
  if (linesError) {
    await supabase.from("customs_clearances").delete().eq("id", clearanceId);
    return fail(linesError.message);
  }

  return { ok: true, id: clearanceId, warnings };
}
