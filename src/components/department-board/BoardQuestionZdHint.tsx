"use client";

import { useEffect, useState } from "react";
import { actionLookupProductZdDelivery } from "@/app/actions/product-zd-lookup";
import { cn } from "@/lib/cn";
import { formatPlDate } from "@/lib/display-labels";
import type { BoardQuestionProductDraft } from "@/lib/department-board/question-product";
import type { ProductZdLookupResult } from "@/lib/subiekt/product-zd-lookup";

/**
 * Najczęstsze pytanie to „kiedy będzie X?” — gdy towar jest z Subiekta, pokaż termin z otwartego ZD,
 * zanim pytanie trafi do zakupów. Pytać nadal można; to tylko podpowiedź.
 */
export function BoardQuestionZdHint({ product }: { product: BoardQuestionProductDraft }) {
  const twId = product.subiektTwId;
  const [state, setState] = useState<{ twId: number; result: ProductZdLookupResult } | null>(null);

  useEffect(() => {
    if (typeof twId !== "number" || twId <= 0) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      actionLookupProductZdDelivery({
        tw_Id: twId,
        tw_Symbol: product.symbol || null,
        tw_Nazwa: product.product || null,
      })
        .then((result) => {
          if (!cancelled) setState({ twId, result });
        })
        .catch(() => {
          /* podpowiedź opcjonalna — bez komunikatu */
        });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // Symbol i nazwa idą razem z twId (wybór z listy Subiekta) — zapytanie tylko przy zmianie towaru.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [twId]);

  if (!state || state.twId !== twId) return null;
  const { result } = state;

  if (result.status === "found" && result.matches[0]) {
    const match = result.matches[0];
    return (
      <p className={cn("rounded-md bg-sky-50/80 px-3 py-2 text-sm text-sky-900 ring-1 ring-inset ring-sky-200/80")}>
        Termin z ZD: <strong className="font-semibold">{formatPlDate(match.deadline)}</strong> ({match.dokNr}
        {result.supplierName ? `, ${result.supplierName}` : ""}). Jeśli o to pytasz - odpowiedź już jest.
      </p>
    );
  }

  if (result.status === "no_match") {
    return (
      <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-inset ring-slate-200/80">
        Brak otwartego ZD na ten towar{result.supplierName ? ` u ${result.supplierName}` : ""} - warto zapytać zakupy.
      </p>
    );
  }

  return null;
}
