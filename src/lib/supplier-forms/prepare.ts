import { fetchSuppliersWithSchedules } from "@/lib/data/queries";
import { resolveSupplierKhIdsForHistory } from "@/lib/orders/zd-order-engine";
import { getSubiektOrdersZd } from "@/lib/subiekt/api";
import {
  buildSupplierFormFill,
  findSupplierFormTemplate,
  type SupplierFormFill,
  type SupplierPdfFormTemplate,
} from "@/lib/supplier-forms/templates";

export type PreparedSupplierForm =
  | {
      ok: true;
      template: SupplierPdfFormTemplate;
      fill: SupplierFormFill;
      dokNr: string;
      supplierName: string;
    }
  | { ok: false; message: string };

/**
 * ZD z Subiekta → wartości formularza dostawcy. ZD musi należeć do tego dostawcy
 * (kontrahent ZD = kh dostawcy) — bez tego łatwo wysłać obce pozycje.
 * Data formularza = data wystawienia ZD (tak wypełniano ręcznie).
 */
export async function prepareSupplierFormForZd(input: {
  dokId: number;
  supplierId: string;
}): Promise<PreparedSupplierForm> {
  const [supplier] = await fetchSuppliersWithSchedules(undefined, {
    activeOnly: false,
    supplierIds: [input.supplierId],
  });
  if (!supplier) return { ok: false, message: "Nie znaleziono dostawcy." };
  const template = findSupplierFormTemplate(supplier.name);
  if (!template) return { ok: false, message: `Dla „${supplier.name}” nie ma jeszcze formularza.` };

  const [doc, kh] = await Promise.all([
    getSubiektOrdersZd(input.dokId),
    resolveSupplierKhIdsForHistory(supplier.id),
  ]);
  const docKh = Number(doc.dok_OdbiorcaId ?? doc.dok_PlatnikId ?? 0);
  if (!kh.ok || !kh.khIds.includes(docKh)) {
    return {
      ok: false,
      message: `${doc.dok_NrPelny ?? `ZD #${input.dokId}`} nie jest wystawione na ${supplier.name} — sprawdź wybrany dokument.`,
    };
  }

  const issued = new Date(String(doc.dok_DataWyst ?? "").slice(0, 10) + "T00:00:00");
  const date = Number.isFinite(issued.getTime()) ? issued : new Date();
  const fill = buildSupplierFormFill(
    template,
    (doc.dok_Pozycja ?? []).map((p) => ({
      symbol: p.tw_Symbol ?? null,
      name: String(p.tw_Nazwa ?? "").trim(),
      qty: Number(p.ob_Ilosc) || 0,
    })),
    { day: date.getDate(), month: date.getMonth() + 1, year: date.getFullYear() }
  );
  return {
    ok: true,
    template,
    fill,
    dokNr: String(doc.dok_NrPelny ?? `ZD ${input.dokId}`),
    supplierName: supplier.name,
  };
}
