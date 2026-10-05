import { fetchSuppliersWithSchedules } from "@/lib/data/queries";
import { resolveSupplierKhIdsForHistory } from "@/lib/orders/zd-order-engine";
import { getSubiektOrdersZd } from "@/lib/subiekt/api";
import {
  findSupplierFormTemplate,
  type SupplierFormLine,
  type SupplierFormTemplate,
} from "@/lib/supplier-forms/templates";

export type PreparedSupplierForm =
  | {
      ok: true;
      template: SupplierFormTemplate;
      lines: SupplierFormLine[];
      dokNr: string;
      /** Data wystawienia ZD — data zamówienia w formularzu. */
      date: Date;
      supplierName: string;
    }
  | { ok: false; message: string };

export type SupplierZd = {
  supplier: { id: string; name: string; location: string | null };
  lines: SupplierFormLine[];
  dokNr: string;
  /** Data wystawienia ZD. */
  date: Date;
};

/**
 * ZD z Subiekta dla dostawcy. ZD musi należeć do tego dostawcy
 * (kontrahent ZD = kh dostawcy) — bez tego łatwo wysłać obce pozycje.
 */
export async function loadSupplierZd(input: {
  dokId: number;
  supplierId: string;
}): Promise<({ ok: true } & SupplierZd) | { ok: false; message: string }> {
  const [supplier] = await fetchSuppliersWithSchedules(undefined, {
    activeOnly: false,
    supplierIds: [input.supplierId],
  });
  if (!supplier) return { ok: false, message: "Nie znaleziono dostawcy." };

  const [doc, kh] = await Promise.all([
    getSubiektOrdersZd(input.dokId),
    resolveSupplierKhIdsForHistory(supplier.id),
  ]);
  const docKh = Number(doc.dok_OdbiorcaId ?? doc.dok_PlatnikId ?? 0);
  if (!kh.ok || !kh.khIds.includes(docKh)) {
    return {
      ok: false,
      message: `${doc.dok_NrPelny ?? `ZD #${input.dokId}`} nie jest wystawione na ${supplier.name} - sprawdź wybrany dokument.`,
    };
  }

  const issued = new Date(String(doc.dok_DataWyst ?? "").slice(0, 10) + "T00:00:00");
  const date = Number.isFinite(issued.getTime()) ? issued : new Date();
  const lines = (doc.dok_Pozycja ?? []).map((p) => ({
    symbol: p.tw_Symbol ?? null,
    name: String(p.tw_Nazwa ?? "").trim(),
    qty: Number(p.ob_Ilosc) || 0,
    twId: Number(p.ob_TowId) || undefined,
  }));
  return {
    ok: true,
    supplier: { id: String(supplier.id), name: supplier.name, location: supplier.location ?? null },
    lines,
    date,
    dokNr: String(doc.dok_NrPelny ?? `ZD ${input.dokId}`),
  };
}

/** ZD → pozycje do formularza dostawcy. Data formularza = data wystawienia ZD (tak wypełniano ręcznie). */
export async function prepareSupplierFormForZd(input: {
  dokId: number;
  supplierId: string;
}): Promise<PreparedSupplierForm> {
  const zd = await loadSupplierZd(input);
  if (!zd.ok) return zd;
  const template = findSupplierFormTemplate(zd.supplier.name);
  if (!template) return { ok: false, message: `Dla „${zd.supplier.name}” nie ma jeszcze formularza.` };
  return {
    ok: true,
    template,
    lines: zd.lines,
    date: zd.date,
    dokNr: zd.dokNr,
    supplierName: zd.supplier.name,
  };
}
