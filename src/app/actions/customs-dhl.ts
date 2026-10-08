"use server";

// @service-role-ok — autoryzacja requireOperations(); zapis przez pulę po warstwie aplikacji.

import { revalidatePath } from "next/cache";
import { requireOperations } from "@/lib/auth";
import { query } from "@/lib/db/pool";
import { cleanUuid } from "@/lib/customs/customs-data";
import { createDhlClearanceForSupplier, prepareDhlClearance } from "@/lib/customs/dhl-sync";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const ODPRAWY_PATH = "/zakupy/odprawy";

/** Odprawa dla przesyłki DHL z dostawcą wybranym ręcznie (automat go nie rozpoznał). */
export async function actionCreateDhlClearance(shipmentId: string, supplierId: string): Promise<Result<{ id: string }>> {
  const user = await requireOperations("mutate");
  const id = cleanUuid(shipmentId);
  const supplier = cleanUuid(supplierId);
  if (!id) return { ok: false, error: "Przesyłka nie istnieje." };
  if (!supplier) return { ok: false, error: "Wybierz dostawcę." };
  const { rows } = await query<{ location: string }>(`SELECT location FROM public.suppliers WHERE id = $1`, [supplier]);
  if (rows[0]?.location !== "IMPORT") return { ok: false, error: "Odprawy robimy tylko dla dostawców typu Import." };
  const res = await createDhlClearanceForSupplier(id, supplier, user.id);
  revalidatePath(ODPRAWY_PATH);
  return res;
}

/** Ponowny odczyt faktury i założenie odprawy (np. po błędzie AI). */
export async function actionRetryDhlShipment(shipmentId: string): Promise<Result<{ id: string | null; note: string | null }>> {
  const user = await requireOperations("mutate");
  const id = cleanUuid(shipmentId);
  if (!id) return { ok: false, error: "Przesyłka nie istnieje." };
  await query(
    `UPDATE public.customs_dhl_shipments SET note = NULL, extraction = NULL, updated_at = now()
      WHERE id = $1 AND clearance_id IS NULL`,
    [id]
  );
  try {
    const clearanceId = await prepareDhlClearance(id, user.id);
    const { rows } = await query<{ note: string | null }>(`SELECT note FROM public.customs_dhl_shipments WHERE id = $1`, [id]);
    revalidatePath(ODPRAWY_PATH);
    return { ok: true, id: clearanceId, note: rows[0]?.note ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Nie udało się odczytać faktury." };
  }
}

/** „Pomiń” — przesyłka nie wymaga odprawy w OnTime (np. załatwiona poza aplikacją). Odwracalne. */
export async function actionDismissDhlShipment(shipmentId: string, dismissed: boolean): Promise<Result> {
  const user = await requireOperations("mutate");
  const id = cleanUuid(shipmentId);
  if (!id) return { ok: false, error: "Przesyłka nie istnieje." };
  await query(
    `UPDATE public.customs_dhl_shipments
        SET dismissed_at = CASE WHEN $2 THEN now() ELSE NULL END,
            dismissed_by = CASE WHEN $2 THEN $3::uuid ELSE NULL END,
            updated_at = now()
      WHERE id = $1`,
    [id, dismissed, user.id]
  );
  revalidatePath(ODPRAWY_PATH);
  return { ok: true };
}
