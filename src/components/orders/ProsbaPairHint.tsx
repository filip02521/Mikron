"use client";

import { useEffect, useState } from "react";
import { actionLookupZdProductPairForTwId } from "@/app/actions/zd-estimate";

/**
 * Podpowiedź przy wyborze towaru w prośbie, gdy towar ma dwie wersje: opakowanie zbiorcze i pojedyncze sztuki.
 * Mówi handlowcowi, którą wybrać — bez słów „para”, „demontaż” (ilość zawsze w jednostkach wybranego towaru).
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
      queueMicrotask(() => setText(null));
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
          const pack = p.packSymbol ?? "opakowanie zbiorcze";
          setText(
            `Ten towar jest też w opakowaniu zbiorczym ${pack} (${p.unitsPerPack} szt.). Wpisz ilość w sztukach - stan liczy obie wersje.`
          );
        } else {
          setText(
            p.pieceSymbol
              ? `To opakowanie zbiorcze: 1 op. = ${p.unitsPerPack} × ${p.pieceSymbol}. Klient chce pojedyncze sztuki? Wybierz ${p.pieceSymbol}.`
              : `To opakowanie zbiorcze (${p.unitsPerPack} szt.). Klient chce pojedyncze sztuki? Wybierz wersję pojedynczą.`
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
