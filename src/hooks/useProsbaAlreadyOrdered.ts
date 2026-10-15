"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import {
  collectProsbaAlreadyOrderedTwIds,
  type ProsbaAlreadyOrderedMap,
} from "@/lib/orders/prosba-already-ordered";
import {
  fetchProsbaAlreadyOrdered,
  isProsbaAlreadyOrderedKnown,
  readProsbaAlreadyOrderedCache,
} from "@/lib/orders/prosba-already-ordered-cache";
import type { IndividualRequestKind } from "@/types/database";
import { useTeethExemptTwIds } from "@/components/layout/TeethExemptContext";

/** Jak synchronizacja stanu Subiekta — nie odpytuje przy każdym znaku. */
const DEBOUNCE_MS = 450;

/** Route handler, nie Server Action — nie kolejkuje innych akcji formularza. */
async function fetchFromApi(
  twIds: number[],
  forSalesPersonId: string | null
): Promise<ProsbaAlreadyOrderedMap> {
  const res = await fetch("/api/subiekt/prosba-already-ordered", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ twIds, forSalesPersonId }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as ProsbaAlreadyOrderedMap;
}

/**
 * „Już zamówione” dla pozycji formularza: otwarte prośby i ZD na wybrane towary.
 * W tle, równolegle ze stanem magazynu; nie blokuje wysyłki.
 */
export function useProsbaAlreadyOrdered(
  lines: readonly Pick<ProductLineDraft, "subiektTwId">[],
  requestKind: IndividualRequestKind,
  enabled: boolean,
  /** Handlowiec, dla którego jest prośba (null = zalogowany). */
  forSalesPersonId: string | null = null
): { map: ProsbaAlreadyOrderedMap; checkingTwIds: ReadonlySet<number> } {
  const teethExemptTwIds = useTeethExemptTwIds();
  const twIds = useMemo(
    () => (enabled ? collectProsbaAlreadyOrderedTwIds(lines, requestKind, teethExemptTwIds) : []),
    [enabled, lines, requestKind, teethExemptTwIds]
  );
  const forId = forSalesPersonId?.trim() || null;
  const key = twIds.length ? `${forId ?? "-"}|${twIds.join(",")}` : "";
  const [fetched, setFetched] = useState<{ key: string; map: ProsbaAlreadyOrderedMap }>({
    key: "",
    map: {},
  });

  useEffect(() => {
    if (!key) return;
    const ids = twIds;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void fetchProsbaAlreadyOrdered(ids, fetchFromApi, forId).then((map) => {
        if (!cancelled) setFetched({ key, map });
      });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // twIds/forId są zakodowane w key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Cache ma pierwszeństwo: powrót do towaru sprawdzonego chwilę temu pokazuje wynik od razu.
  const map = useMemo(() => {
    if (!key) return {};
    const cached = readProsbaAlreadyOrderedCache(twIds, forId);
    if (fetched.key === key) return { ...fetched.map, ...cached };
    // Dopisanie pozycji: do czasu nowej odpowiedzi trzymaj poprzedni wynik dla tych samych
    // towarów. Inny handlowiec = inne „moje prośby” — nic nie przenosimy.
    const previous: ProsbaAlreadyOrderedMap = {};
    if (fetched.key.split("|")[0] === (forId ?? "-")) {
      for (const id of twIds) if (fetched.map[id]) previous[id] = fetched.map[id];
    }
    return { ...previous, ...cached };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, fetched]);

  // „Sprawdzam…” tylko dla towarów bez żadnego wyniku.
  const checkingTwIds = useMemo(() => {
    if (!key || fetched.key === key) return new Set<number>();
    return new Set(twIds.filter((id) => !map[id] && !isProsbaAlreadyOrderedKnown(id, forId)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, fetched, map]);

  return { map, checkingTwIds };
}
