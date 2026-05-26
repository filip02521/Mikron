import { unstable_cache } from "next/cache";
import type { OrderZdLookupInput } from "@/lib/subiekt/zd-eta";
import {
  isOrderEligibleForZdLookup,
  orderSubiektKhId,
  resolveSubiektZdEtasForOrders,
  ZD_LOOKUP_STATUSES,
  type SubiektZdEta,
} from "@/lib/subiekt/zd-eta";

/** Odświeżanie terminów ZD z Subiekta — co 2 godziny na handlowca. */
export const ZD_ETA_CACHE_REVALIDATE_SEC = 2 * 60 * 60;

export type ZdEtaFetchMeta = {
  fetchedAt: number;
  nextRefreshAt: number;
  eligibleCount: number;
  matchedCount: number;
  /** Prośby zamówieniowe bez powiązania dostawcy z Subiektem — pominięte w wyszukiwaniu ZD. */
  skippedNoSubiektLink: number;
  /** true gdy odpowiedź z pamięci podręcznej Next (bez nowych zapytań do Subiekta). */
  servedFromCache: boolean;
};

/** Zamówienia, które mogłyby mieć ZD, ale dostawca nie ma kh_Id. */
export function countZdSkippedNoSubiektLink(orders: OrderZdLookupInput[]): number {
  return orders.filter(
    (o) =>
      o.request_kind !== "informacja" &&
      orderSubiektKhId(o) == null &&
      ZD_LOOKUP_STATUSES.has(o.status)
  ).length;
}

export type ZdEtaFetchResult = {
  etas: Record<string, SubiektZdEta>;
  meta: ZdEtaFetchMeta;
};

export function countZdEligibleOrders(orders: OrderZdLookupInput[]): number {
  return orders.filter(isOrderEligibleForZdLookup).length;
}

export function buildZdEtaOrdersFingerprint(orders: OrderZdLookupInput[]): string {
  return orders
    .filter(isOrderEligibleForZdLookup)
    .map(
      (o) =>
        `${o.id}:${orderSubiektKhId(o)}:${o.subiekt_tw_id ?? ""}:${o.symbol}:${o.products}`
    )
    .sort()
    .join("|");
}

function formatZdEtaMeta(
  etas: Record<string, SubiektZdEta>,
  eligibleCount: number,
  skippedNoSubiektLink: number,
  fetchedAt: number,
  servedFromCache: boolean
): ZdEtaFetchMeta {
  return {
    fetchedAt,
    nextRefreshAt: fetchedAt + ZD_ETA_CACHE_REVALIDATE_SEC * 1000,
    eligibleCount,
    matchedCount: Object.keys(etas).length,
    skippedNoSubiektLink,
    servedFromCache,
  };
}

/**
 * Terminy ZD dla panelu Moje zamówienia — cache 2 h (tag: zd-eta-{salesPersonId}).
 */
export async function getSubiektZdEtasForMojePanel(
  salesPersonId: string,
  orders: OrderZdLookupInput[],
  options?: { force?: boolean }
): Promise<ZdEtaFetchResult> {
  const scope = salesPersonId || "all";
  const fingerprint = buildZdEtaOrdersFingerprint(orders);
  const eligibleCount = countZdEligibleOrders(orders);
  const skippedNoSubiektLink = countZdSkippedNoSubiektLink(orders);

  if (eligibleCount === 0) {
    const now = Date.now();
    return {
      etas: {},
      meta: formatZdEtaMeta({}, 0, skippedNoSubiektLink, now, true),
    };
  }

  if (options?.force) {
    const { revalidateTag } = await import("next/cache");
    revalidateTag(`zd-eta-${scope}`, { expire: 0 });
  }

  const run = unstable_cache(
    async () => {
      const etas = await resolveSubiektZdEtasForOrders(orders);
      return {
        etas,
        fetchedAt: Date.now(),
      };
    },
    ["zd-eta-v4", scope, fingerprint],
    {
      revalidate: ZD_ETA_CACHE_REVALIDATE_SEC,
      tags: [`zd-eta-${scope}`],
    }
  );

  const { etas, fetchedAt } = await run();
  const servedFromCache = Date.now() - fetchedAt > 5_000;

  return {
    etas,
    meta: formatZdEtaMeta(
      etas,
      eligibleCount,
      skippedNoSubiektLink,
      fetchedAt,
      servedFromCache
    ),
  };
}
