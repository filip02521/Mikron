"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { parseDailySupplierSource, type DailySupplierSource } from "@/lib/orders/daily-supplier-rows";

/** Filtr źródła listy „Dostawcy na dziś” w adresie (`?zrodlo=`); brak parametru = wszyscy. */
export function useDailySupplierSourceFilter(): {
  source: DailySupplierSource | null;
  setSource: (next: DailySupplierSource | null) => void;
} {
  const searchParams = useSearchParams();
  const source = parseDailySupplierSource(searchParams.get("zrodlo"));
  const setSource = useCallback(
    (next: DailySupplierSource | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set("zrodlo", next);
      else params.delete("zrodlo");
      const q = params.toString();
      // Filtr czysto kliencki — replaceState aktualizuje useSearchParams bez ponownego renderu serwera.
      window.history.replaceState(null, "", q ? `/podsumowanie?${q}` : "/podsumowanie");
    },
    [searchParams]
  );
  return { source, setSource };
}
