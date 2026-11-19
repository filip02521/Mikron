import { query } from "@/lib/db/pool";
import {
  fetchServicePartTwIds,
  loadServicePartSupplierCandidates,
  resolveServicePartsCecha,
} from "@/lib/data/service-parts";
import { fetchProductsWithCecha } from "@/lib/data/service-parts-overview";
import { batchAddIndividualOrders, cancelIndividualOrder } from "@/lib/services/orders";
import { SERVICE_PARTS_CECHA_NAME } from "@/lib/orders/service-parts";
import { SERVICE_PART_ACTIVE_REQUEST_STATUSES } from "@/lib/orders/service-parts-overview";
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
  user: { id: string; salesPersonId: string | null },
  /**
   * Zgłoszenie ze zlecenia („czeka na część”): każdy towar z Subiektu (część bez cechy też bywa potrzebna do naprawy),
   * nazwa sprawdzona już w Subiekcie. Bez tego — tylko części z cechą „Części serwisowe” (ekran Części).
   */
  fromOrder?: { symbol: string | null; name: string } | null
): Promise<ServicePartReportOutcome> {
  let symbol: string | undefined;
  let name: string;
  if (fromOrder) {
    symbol = fromOrder.symbol?.trim() || undefined;
    name = fromOrder.name.trim() || symbol || `Towar ${input.twId}`;
  } else {
    const cecha = await resolveServicePartsCecha();
    if (!cecha) {
      return { ok: false, message: `Nie znaleziono cechy „${SERVICE_PARTS_CECHA_NAME}” w indeksie Subiekta.` };
    }
    // tw_Id przychodzi z przeglądarki — z ekranu Części zgłaszać można tylko części z cechą serwisową.
    const serviceTwIds = new Set(await fetchServicePartTwIds(cecha.cechaId));
    if (!serviceTwIds.has(input.twId)) {
      return { ok: false, message: `Ten towar nie ma cechy „${SERVICE_PARTS_CECHA_NAME}” — zgłoś go ze zlecenia („Wstrzymaj — czeka na część”).` };
    }
    const products = await fetchProductsWithCecha(cecha.cechaId);
    const product = products.find((p) => Math.trunc(Number(p.tw_Id)) === input.twId);
    symbol = product?.tw_Symbol?.trim() || undefined;
    name = product?.tw_Nazwa?.trim() || symbol || `Towar ${input.twId}`;
  }
  // Ta sama prośba drugi raz (ponowne wstrzymanie tego samego zlecenia, podwójne kliknięcie) — bez duplikatu.
  const requestNote = servicePartRequestNote(input.note);
  const existing = await query<{ status: string; quantity: string }>(
    `SELECT status::text AS status, quantity FROM individual_orders
      WHERE subiekt_tw_id = $1 AND sales_request_note = $2 AND status::text = ANY($3::text[])
      ORDER BY created_at DESC LIMIT 1`,
    [input.twId, requestNote, SERVICE_PART_ACTIVE_REQUEST_STATUSES]
  );
  if (existing.rows[0]) {
    const label: Record<string, string> = { Nowe: "nowa", Weryfikacja: "w weryfikacji", Zamowione: "zamówiona", Czesciowo_zrealizowane: "częściowo dostarczona" };
    const st = existing.rows[0].status;
    return { ok: true, message: `Prośba o ${name} już jest (${existing.rows[0].quantity} szt., ${label[st] ?? st}) — nie dubluję.` };
  }
  const salesPersonId = await resolveServiceSalesPersonId(user.salesPersonId);
  if (!salesPersonId) {
    return {
      ok: false,
      message: `Nie wiem, na kogo zapisać zgłoszenie. W grupie „${SERVICE_SALES_GROUP_NAME}” musi być jedna karta „Serwis” (Zespół → Handlowcy).`,
    };
  }
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
        requestNote,
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

/**
 * Zlecenie serwisu anulowane: prośby o części z tego zlecenia, których zakupy jeszcze nie zamówiły (Nowe, Weryfikacja),
 * anulujemy — nikt ich już nie potrzebuje. Zamówione i częściowo dostarczone zostają (ZD mogło już wyjść).
 */
export async function cancelUnorderedServiceOrderRequests(
  orderNumber: string
): Promise<{ cancelled: string[]; kept: { product: string; status: string }[] }> {
  const res = await query<{ id: string; product: string; status: string }>(
    `SELECT id, product, status::text AS status FROM individual_orders
      WHERE sales_request_note = $1 AND sales_cancelled_at IS NULL AND status::text = ANY($2::text[])`,
    [servicePartRequestNote(orderNumber), SERVICE_PART_ACTIVE_REQUEST_STATUSES]
  );
  const cancelled: string[] = [];
  const kept: { product: string; status: string }[] = [];
  for (const r of res.rows) {
    if (r.status !== "Nowe" && r.status !== "Weryfikacja") {
      kept.push({ product: r.product, status: r.status });
      continue;
    }
    try {
      await cancelIndividualOrder(r.id, `Anulowano automatycznie: zlecenie serwisu ${orderNumber} anulowane.`, { notify: false });
      cancelled.push(r.product);
    } catch {
      // Zakupy zmieniły status w międzyczasie (np. zamówili) — prośba zostaje.
      kept.push({ product: r.product, status: r.status });
    }
  }
  return { cancelled, kept };
}
