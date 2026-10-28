/**
 * Pamięć korekt: wzorzec z dziennika decyzji (`zd-line-decisions.ts`) nakładany na cel linii.
 * 3 z 4 ostatnich ZD podniesione ≥ 1,5× → cel × mediana (w granicach 0,5–2); obniżane → analogicznie w dół;
 * zdejmowane z listy → tylko znacznik (ilości nie zerujemy — brak towaru kosztuje więcej niż nadwyżka).
 * Zapas minimalny nie jest skalowany. Czysta funkcja; silnik woła ją po śledzeniu sprzedaży.
 */
import type { ZdLineDecisionPattern } from "@/lib/data/zd-line-decisions";
import { computeManualOrderQty, type ManualZdEstimateLine } from "@/lib/orders/zd-estimate-manual";

export function applyUserPatternToManualLine(
  line: ManualZdEstimateLine,
  pattern: ZdLineDecisionPattern,
  input: { zapasMin: number; otwarteZdPieces: number; minStockSzt?: number }
): ManualZdEstimateLine {
  if (pattern.kind === "drop" || line.pair || line.bom) return { ...line, userPattern: pattern };
  const celTracked = Math.max(0, Number(line.celZapasuTracked ?? line.celZapasu) || 0);
  const min = Math.min(celTracked, Math.max(0, input.zapasMin));
  const next = Math.round((min + (celTracked - min) * pattern.factor) * 1e6) / 1e6;
  return {
    ...line,
    celZapasuTracked: next,
    salesTrackDelta: next - (Number(line.celZapasu) || 0),
    doZamowieniaReczne: computeManualOrderQty({
      celZapasu: next,
      dostepne: line.dostepne,
      otwarteZd: input.otwarteZdPieces,
      minStockSzt: input.minStockSzt,
    }),
    userPattern: pattern,
  };
}

/** Jedno zdanie do karty, znacznika i bezpiecznika propozycji. */
export function formatUserPattern(p: ZdLineDecisionPattern): string {
  const f = p.factor.toLocaleString("pl-PL", { maximumFractionDigits: 2 });
  if (p.kind === "drop") return `Zdejmowałeś tę linię z ZD ${p.agree} z ${p.of} ostatnich razy.`;
  if (p.kind === "up") return `Podnosiłeś ilość ${p.agree} z ${p.of} ostatnich razy — cel × ${f}.`;
  return `Obniżałeś ilość ${p.agree} z ${p.of} ostatnich razy — cel × ${f}.`;
}
