import { stripQuery } from "@/lib/posthog/config";

// Klucze z adresem: $current_url, $referrer, $initial_current_url, $initial_referrer, href…
const URL_KEY = /(url|referrer|href)$/i;

type Props = Record<string, unknown> | undefined;
type SnapshotItem = { data?: { href?: unknown } } | null;

function stripUrls(props: Props) {
  if (!props) return;
  for (const key of Object.keys(props)) {
    if (URL_KEY.test(key)) props[key] = stripQuery(props[key]);
  }
}

/**
 * before_send: adresy bez query we wszystkich zdarzeniach, właściwościach osoby i nagraniach
 * (?klient=, ?q= niosą nazwy klientów i osób). Import: tylko klient.
 */
export function scrubCapture<
  T extends { event: string; properties: Record<string, unknown>; $set?: Props; $set_once?: Props },
>(cr: T): T {
  stripUrls(cr.properties);
  stripUrls(cr.$set);
  stripUrls(cr.$set_once);
  const snapshot = cr.event === "$snapshot" ? cr.properties.$snapshot_data : null;
  if (Array.isArray(snapshot)) {
    // Zdarzenie Meta rrweb (type 4) zapisuje adres strony w data.href.
    for (const item of snapshot as SnapshotItem[]) {
      // data bywa skompresowanym tekstem — tylko obiekt ma href.
      if (typeof item?.data === "object" && item.data && "href" in item.data) {
        item.data.href = stripQuery(item.data.href);
      }
    }
  }
  return cr;
}
