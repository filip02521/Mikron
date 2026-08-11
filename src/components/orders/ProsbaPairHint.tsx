"use client";

import { useEffect, useState } from "react";
import { actionLookupZdProductPairForTwId } from "@/app/actions/zd-estimate";

/**
 * Hint przy wyborze SKU w prośbie — para montaż/demontaż (qty nadal w sztukach).
 */
export function ProsbaPairHint({
  twId,
}: {
  twId: number | null | undefined;
}) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const id = twId != null && twId > 0 ? Math.trunc(twId) : null;
    if (!id) {
      setText(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await actionLookupZdProductPairForTwId(id);
        if (cancelled) return;
        if (!res.ok || !res.pair) {
          setText(null);
          return;
        }
        const p = res.pair;
        if (res.role === "piece") {
          setText(
            `Para z paczką ${p.packSymbol ?? `tw ${p.packTwId}`} (${p.unitsPerPack} szt/pacz.). Zamawiasz sztuki — ZD zwykle idzie na paczki.`
          );
        } else {
          setText(
            `Para ze sztukami ${p.pieceSymbol ?? `tw ${p.pieceTwId}`} (${p.unitsPerPack} szt/pacz.). Prośby handlowe zwykle w sztukach.`
          );
        }
      } catch {
        if (!cancelled) setText(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [twId]);

  if (!text) return null;
  return (
    <p className="mt-1.5 text-[11px] leading-snug text-indigo-800/90">
      {text}
    </p>
  );
}
