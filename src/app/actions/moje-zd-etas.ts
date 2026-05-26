"use server";

import { getSessionUser } from "@/lib/auth";
import { canAccessOperations, isSalesAccount, isSalesManager } from "@/lib/auth-roles";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { resolvePreviewSalesPerson } from "@/lib/auth/resolve-preview-sales-person";
import { fetchDeliveryStats, fetchIndividualOrders } from "@/lib/data/queries";
import { presentMyOrders } from "@/lib/orders/my-order-presenter";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import {
  getSubiektZdEtasForMojePanel,
  type ZdEtaFetchMeta,
} from "@/lib/subiekt/zd-eta-cache";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";

export type MojeZdEtasRefreshResult =
  | {
      ok: true;
      zamowienia: MyOrderRow[];
      informacje: MyOrderRow[];
      productLineCount: number;
      meta: ZdEtaFetchMeta;
    }
  | { ok: false; message: string };

async function assertCanLoadMojeZdEtas(salesPersonId: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error("Brak sesji");

  if (canAccessOperations(user.role)) return;

  if (!isSalesAccount(user.role)) {
    throw new Error("Brak uprawnień");
  }

  const own = await resolveSalesPersonForUser(user);
  if (own?.id === salesPersonId) return;

  if (isSalesManager(user.role)) {
    const preview = await resolvePreviewSalesPerson(salesPersonId, user);
    if (preview) return;
  }

  throw new Error("Brak uprawnień do podglądu tych zamówień");
}

/** Uzupełnia terminy ZD (cache 2 h) — wywoływane z klienta po szybkim pierwszym renderze. */
export async function actionRefreshMojeZdEtas(
  salesPersonId: string,
  options?: { force?: boolean }
): Promise<MojeZdEtasRefreshResult> {
  try {
    await assertCanLoadMojeZdEtas(salesPersonId);

    if (!(await isSubiektReachable())) {
      return { ok: false, message: "Subiekt niedostępny — pokazujemy szacunki z historii dostaw." };
    }

    const [orders, stats] = await Promise.all([
      fetchIndividualOrders({
        salesPersonId,
        hideSalesAcknowledged: false,
      }),
      fetchDeliveryStats(),
    ]);

    const { etas, meta } = await getSubiektZdEtasForMojePanel(
      salesPersonId,
      orders,
      options
    );

    const presented = presentMyOrders(orders, stats, etas);

    return {
      ok: true,
      ...presented,
      meta,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Nie udało się pobrać terminów ZD",
    };
  }
}
