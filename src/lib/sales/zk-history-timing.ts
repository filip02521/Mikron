import type { ZkLinkableOrder } from "@/lib/sales/zk-watch-order-link";

/**
 * Termin „z historii dostawcy” dla prośby bez ZD — ten sam presenter co /moje,
 * żeby podgląd na /zk nie pokazywał „Jeszcze nie ustalono”, gdy /moje ma szacunek.
 * Błąd = brak podpowiedzi (podgląd ZK działa dalej).
 */
export async function attachZkHistoryTimingLabels(
  salesPersonId: string,
  orders: ZkLinkableOrder[]
): Promise<ZkLinkableOrder[]> {
  const needed = new Set(
    orders
      .filter((o) => !o.zd_fulfillment_deadline?.trim() && o.status !== "Zrealizowane")
      .map((o) => o.id)
  );
  if (needed.size === 0) return orders;

  try {
    const [{ fetchIndividualOrders, fetchDeliveryStats }, { presentMyOrders }, { loadDeliveryEtaQuantilesForOrders }] =
      await Promise.all([
        import("@/lib/data/queries"),
        import("@/lib/orders/my-order-presenter"),
        import("@/lib/orders/delivery-eta-quantiles-load"),
      ]);
    const [all, stats] = await Promise.all([
      fetchIndividualOrders({ salesPersonId }),
      fetchDeliveryStats(),
    ]);
    const relevant = all.filter((o) => needed.has(o.id));
    if (relevant.length === 0) return orders;
    const quantiles = await loadDeliveryEtaQuantilesForOrders(relevant);
    const { zamowienia } = presentMyOrders(relevant, stats, {
      useP50: quantiles.useP50,
      etaQuantilesBySupplierId: quantiles.bySupplierId,
    });

    const labelById = new Map<string, string>();
    for (const row of zamowienia) {
      if (row.zdFulfillment || !row.timingLabel) continue;
      for (const id of row.orderIds) labelById.set(id, row.timingLabel);
    }
    return orders.map((o) =>
      labelById.has(o.id) ? { ...o, history_timing_label: labelById.get(o.id)! } : o
    );
  } catch (e) {
    console.error("[attachZkHistoryTimingLabels]", e);
    return orders;
  }
}
