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
  pickServicePartSupplier,
  servicePartRequestNote,
  SERVICE_SALES_GROUP_NAME,
} from "@/lib/orders/service-part-report";

export type ServicePartReportOutcome = { ok: true; message: string } | { ok: false; message: string };

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

/**
 * Prośba do zakupów o część serwisową (ekran części i „czeka na część” w zleceniu). Dane wejściowe
 * już sprawdzone (`parseServicePartReport`); tu: cecha, karta Serwis, dostawca. Rzuca tylko przy awarii.
 */
export async function reportServicePartShortage(
  input: { twId: number; quantity: number; note: string },
  user: { id: string; salesPersonId: string | null }
): Promise<ServicePartReportOutcome> {
  const cecha = await resolveServicePartsCecha();
  if (!cecha) {
    return { ok: false, message: `Nie znaleziono cechy „${SERVICE_PARTS_CECHA_NAME}” w indeksie Subiekta.` };
  }
  // tw_Id przychodzi z przeglądarki — zgłaszać można tylko części z cechą serwisową.
  const serviceTwIds = new Set(await fetchServicePartTwIds(cecha.cechaId));
  if (!serviceTwIds.has(input.twId)) {
    return { ok: false, message: `Ten towar nie ma cechy „${SERVICE_PARTS_CECHA_NAME}” — zgłoś go zakupom inną drogą (prośba).` };
  }
  const salesPersonId = await resolveServiceSalesPersonId(user.salesPersonId);
  if (!salesPersonId) {
    return {
      ok: false,
      message: `Nie wiem, na kogo zapisać zgłoszenie. W grupie „${SERVICE_SALES_GROUP_NAME}” musi być jedna karta „Serwis” (Zespół → Handlowcy).`,
    };
  }
  const products = await fetchProductsWithCecha(cecha.cechaId);
  const product = products.find((p) => Math.trunc(Number(p.tw_Id)) === input.twId);
  const symbol = product?.tw_Symbol?.trim() || undefined;
  const name = product?.tw_Nazwa?.trim() || symbol || `Towar ${input.twId}`;

  // Dostawca od razu: prośba trafia do „Nowe” u dostawcy zamiast do Weryfikacji (prośba bez dostawcy).
  const supplier = pickServicePartSupplier(await loadServicePartSupplierCandidates(input.twId));

  const added = await batchAddIndividualOrders(
    [
      {
        supplierId: supplier?.supplierId,
        salesPersonId,
        subiektTwId: input.twId,
        symbol,
        product: name,
        quantity: String(input.quantity),
        requestKind: "zamowienie",
        requestNote: servicePartRequestNote(input.note),
        source: "subiekt",
      },
    ],
    user.id === "dev" ? undefined : user.id,
    { submitMode: "sales" }
  );
  const where =
    supplier && added.complete > 0
      ? `Zakupy widzą prośbę u dostawcy ${supplier.supplierName}.`
      : "Bez znanego dostawcy — zakupy przypiszą go w Weryfikacji.";
  return { ok: true, message: `Zgłoszono ${input.quantity} szt. ${name}. ${where}` };
}
