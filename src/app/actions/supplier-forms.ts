"use server";

import { requireOperations } from "@/lib/auth";
import { query } from "@/lib/db/pool";
import { fetchSuppliersWithSchedules } from "@/lib/data/queries";
import { resolveSupplierKhIdsForHistory } from "@/lib/orders/zd-order-engine";
import { searchSubiektOrdersZd } from "@/lib/subiekt/api";
import { SubiektRequestError } from "@/lib/subiekt/errors";
import { zdListItemMatchesSupplierKhIds } from "@/lib/subiekt/zd-document-kh";
import { prepareSupplierFormForZd } from "@/lib/supplier-forms/prepare";
import { previewSupplierForm } from "@/lib/supplier-forms/render";
import { findSupplierFormTemplate, type SupplierFormLine } from "@/lib/supplier-forms/templates";
import { warsawNowParts } from "@/lib/time/warsaw";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";

export type SupplierFormZd = {
  dokId: number;
  dokNr: string;
  dataWyst: string | null;
  mappedCount: number;
  /** Pozycje bez pola w formularzu — trafią do uwag. */
  unmapped: SupplierFormLine[];
  error: string | null;
};

/** Ostatnie ZD dostawcy (także świeżo utworzone) z podglądem formularza. */
export async function actionListSupplierFormZds(
  supplierId: string
): Promise<
  | { ok: true; templateLabel: string; fileKind: "pdf" | "xlsx"; documents: SupplierFormZd[] }
  | { ok: false; message: string }
> {
  await requireOperations("read");
  try {
    const [supplier] = await fetchSuppliersWithSchedules(undefined, {
      activeOnly: false,
      supplierIds: [supplierId],
    });
    const template = findSupplierFormTemplate(supplier?.name);
    if (!supplier || !template) return { ok: false, message: "Ten dostawca nie ma formularza zamówienia." };
    const kh = await resolveSupplierKhIdsForHistory(supplier.id);
    if (!kh.ok || kh.khIds.length === 0) {
      return { ok: false, message: "Dostawca bez powiązania z kontrahentem w Subiekcie." };
    }

    // Historia: zsynchronizowany indeks ZD. Świeże (jeszcze bez synchronizacji): Subiekt, 7 dni.
    const dataDo = warsawNowParts().dateKey;
    const from = new Date(`${dataDo}T12:00:00Z`);
    from.setUTCDate(from.getUTCDate() - 7);
    const [indexed, live] = await Promise.all([
      query<{ dok_id: number; dok_nr_pelny: string | null; dok_data_wyst: string | null }>(
        `SELECT dok_id, dok_nr_pelny, dok_data_wyst FROM subiekt_zd_index
          WHERE supplier_id = $1 ORDER BY dok_data_wyst DESC NULLS LAST, dok_id DESC LIMIT 5`,
        [supplier.id]
      ),
      searchSubiektOrdersZd({ dataOd: from.toISOString().slice(0, 10), dataDo, page: 1, pageSize: 200 }),
    ]);
    const byId = new Map<number, { dokId: number; dokNr: string; dataWyst: string | null }>();
    for (const r of indexed.rows) {
      byId.set(Number(r.dok_id), {
        dokId: Number(r.dok_id),
        dokNr: String(r.dok_nr_pelny ?? "").trim() || `ZD ${r.dok_id}`,
        dataWyst: r.dok_data_wyst ? String(r.dok_data_wyst).slice(0, 10) : null,
      });
    }
    for (const d of (live.data ?? []).filter((x) => zdListItemMatchesSupplierKhIds(x, kh.khIds))) {
      const dokId = Number(d.dok_Id);
      if (!(dokId > 0)) continue;
      byId.set(dokId, {
        dokId,
        dokNr: String(d.dok_NrPelny ?? "").trim() || `ZD ${dokId}`,
        dataWyst: d.dok_DataWyst ? String(d.dok_DataWyst).slice(0, 10) : null,
      });
    }
    const recent = [...byId.values()]
      .sort((a, b) => (b.dataWyst ?? "").localeCompare(a.dataWyst ?? "") || b.dokId - a.dokId)
      // Zapas na ZD usunięte w Subiekcie (pomijane niżej) — pokazujemy do 5.
      .slice(0, 7);

    const documents = (
      await Promise.all(
        recent.map(async (d): Promise<SupplierFormZd | null> => {
          const prepared = await prepareSupplierFormForZd({ dokId: d.dokId, supplierId }).catch((e: unknown) =>
            // ZD usunięte w Subiekcie, a jeszcze w indeksie — pomijamy na liście.
            e instanceof SubiektRequestError && e.status === 404
              ? null
              : { ok: false as const, message: userFacingErrorText(e, "Błąd odczytu ZD.") }
          );
          if (prepared === null) return null;
          if (!prepared.ok) return { ...d, mappedCount: 0, unmapped: [], error: prepared.message };
          const preview = await previewSupplierForm(prepared);
          return { ...d, ...preview, error: null };
        })
      )
    )
      .filter((d): d is SupplierFormZd => d !== null)
      .slice(0, 5);
    return {
      ok: true,
      templateLabel: template.label,
      fileKind: template.kind === "pdf" ? "pdf" : "xlsx",
      documents,
    };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się pobrać ZD z Subiektu.") };
  }
}
