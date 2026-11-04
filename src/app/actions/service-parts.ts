"use server";

import { revalidatePath } from "next/cache";
import { requireServicePanel } from "@/lib/auth";
import { query } from "@/lib/db/pool";
import {
  fetchServicePartTwIds,
  loadServicePartSupplierCandidates,
  resolveServicePartsCecha,
} from "@/lib/data/service-parts";
import { fetchProductsWithCecha } from "@/lib/data/service-parts-overview";
import { batchAddIndividualOrders } from "@/lib/services/orders";
import { SERVICE_PARTS_CECHA_NAME } from "@/lib/orders/service-parts";
import {
  parseServicePartReport,
  pickServicePartSupplier,
  servicePartRequestNote,
  SERVICE_SALES_GROUP_NAME,
  type ServicePartReportInput,
} from "@/lib/orders/service-part-report";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";

export type ServicePartReportResult = { ok: true; message: string } | { ok: false; message: string };

/**
 * Karta handlowca, na którą idzie prośba: własna karta serwisanta albo karta „Serwis”
 * z grupy Serwis (gdy zgłasza admin, zakupy lub magazyn bez własnej karty).
 */
async function resolveServiceSalesPersonId(userSalesPersonId: string | null): Promise<string | null> {
  if (userSalesPersonId) {
    const own = await query<{ id: string }>(`SELECT id FROM sales_people WHERE id = $1`, [userSalesPersonId]);
    if (own.rows[0]) return own.rows[0].id;
  }
  const res = await query<{ id: string; name: string }>(
    `SELECT sp.id, sp.name
       FROM sales_people sp
       JOIN sales_groups g ON g.id = sp.group_id
      WHERE lower(trim(g.name)) = lower($1)`,
    [SERVICE_SALES_GROUP_NAME]
  );
  // Jednoznacznie: karta o nazwie „Serwis”, a bez niej jedyna karta w grupie. Kilka kart bez „Serwis” = błąd,
  // żeby prośby nie lądowały na przypadkowej osobie.
  const named = res.rows.filter((r) => r.name.trim().toLowerCase() === SERVICE_SALES_GROUP_NAME.toLowerCase());
  if (named.length === 1) return named[0]!.id;
  if (named.length === 0 && res.rows.length === 1) return res.rows[0]!.id;
  return null;
}

export async function actionReportServicePartShortage(
  input: ServicePartReportInput
): Promise<ServicePartReportResult> {
  const user = await requireServicePanel("mutate");
  const parsed = parseServicePartReport(input);
  if (!parsed.ok) return parsed;
  try {
    const cecha = await resolveServicePartsCecha();
    if (!cecha) {
      return { ok: false, message: `Nie znaleziono cechy „${SERVICE_PARTS_CECHA_NAME}” w indeksie Subiekta.` };
    }
    // tw_Id przychodzi z przeglądarki — zgłaszać można tylko części z cechą serwisową.
    const serviceTwIds = new Set(await fetchServicePartTwIds(cecha.cechaId));
    if (!serviceTwIds.has(parsed.twId)) {
      return { ok: false, message: `Ten towar nie ma cechy „${SERVICE_PARTS_CECHA_NAME}”. Odśwież listę.` };
    }
    const salesPersonId = await resolveServiceSalesPersonId(user.salesPersonId);
    if (!salesPersonId) {
      return {
        ok: false,
        message: `Nie wiem, na kogo zapisać zgłoszenie. W grupie „${SERVICE_SALES_GROUP_NAME}” musi być jedna karta „Serwis” (Zespół → Handlowcy).`,
      };
    }
    const products = await fetchProductsWithCecha(cecha.cechaId);
    const product = products.find((p) => Math.trunc(Number(p.tw_Id)) === parsed.twId);
    const symbol = product?.tw_Symbol?.trim() || undefined;
    const name = product?.tw_Nazwa?.trim() || symbol || `Towar ${parsed.twId}`;

    // Dostawca od razu: prośba trafia do „Nowe” u dostawcy zamiast do Weryfikacji (prośba bez dostawcy).
    const supplier = pickServicePartSupplier(await loadServicePartSupplierCandidates(parsed.twId));

    const added = await batchAddIndividualOrders(
      [
        {
          supplierId: supplier?.supplierId,
          salesPersonId,
          subiektTwId: parsed.twId,
          symbol,
          product: name,
          quantity: String(parsed.quantity),
          requestKind: "zamowienie",
          requestNote: servicePartRequestNote(parsed.note),
          source: "subiekt",
        },
      ],
      user.id === "dev" ? undefined : user.id,
      { submitMode: "sales" }
    );
    revalidatePath("/serwis");
    const where =
      supplier && added.complete > 0
        ? `Zakupy widzą prośbę u dostawcy ${supplier.supplierName}.`
        : "Bez znanego dostawcy — zakupy przypiszą go w Weryfikacji.";
    return { ok: true, message: `Zgłoszono ${parsed.quantity} szt. ${name}. ${where}` };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się zgłosić braku. Spróbuj ponownie.") };
  }
}
