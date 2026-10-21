/**
 * „Dlaczego tyle” w karcie produktu — kroki od celu zapasu do jednostek na ZD.
 * Wynik końcowy zawsze z tego samego `resolveOrderQtyForLine` co tabela; gdy kroki
 * nie sumują się do niego (rezerwacje ZK pod prośby), pokazujemy jawną korektę.
 */

import { formatQty, type ManualZdEstimateLine } from "@/lib/orders/zd-estimate-manual";
import type { ZdEstimateExtrasPolicy } from "@/lib/orders/zd-estimate-extras-policy";
import {
  isPackagingPackagesMode,
  type ZdPackOrderQty,
} from "@/lib/orders/zd-estimate-packaging";

export type ZdOrderExplainStep = {
  key: string;
  label: string;
  /** Sztuki albo jednostki dokumentu — patrz `unit`. */
  value: number;
  unit: string;
  kind: "base" | "minus" | "plus" | "result" | "note";
};

function ceilPos(n: number): number {
  return Math.max(0, Math.ceil(Math.round(n * 1e6) / 1e6 - 1e-9));
}

export function explainZdOrderQty(input: {
  line: Pick<
    ManualZdEstimateLine,
    "celZapasu" | "celZapasuTracked" | "dostepne" | "pair" | "demandFloor"
  > &
    Partial<Pick<ManualZdEstimateLine, "stockoutAdjust" | "salesProfile">>;
  qty: ZdPackOrderQty;
  /** Otwarte ZD przeliczone na sztuki (dla pary — już w pokryciu). */
  openZdPieces: number;
  extraPieces: number;
  extraOnly: boolean;
  extrasPolicy: ZdEstimateExtrasPolicy;
  minStockSzt?: number | null;
  /** Ręcznie wpisane Do ZD (jednostki dokumentu), gdy różne od wyliczenia. */
  overrideZdUnits?: number | null;
}): ZdOrderExplainStep[] {
  const { line, qty } = input;
  const steps: ZdOrderExplainStep[] = [];
  const pair = line.pair?.role === "pack" && !line.pair.partnerMissing ? line.pair : null;
  const minStock = Math.max(0, Number(input.minStockSzt) || 0);
  const extra = Math.max(0, Math.ceil(input.extraPieces || 0));

  let expected: number;
  if (input.extraOnly) {
    steps.push({ key: "mode", label: "Tylko na prośbę — bez celu zapasu", value: 0, unit: "", kind: "note" });
    if (extra > 0) steps.push({ key: "extra", label: "Prośby handlowców", value: extra, unit: "szt", kind: "plus" });
    if (minStock > 0) {
      steps.push({ key: "min", label: "Minimum stanów (poziom)", value: minStock, unit: "szt", kind: "base" });
    }
    expected = qty.piecesNeeded;
  } else {
    if (line.demandFloor) {
      const f = line.demandFloor;
      steps.push({
        key: "floor",
        label: `Średnia 90 dni wyższa niż ostatnie tempo (${formatQty(f.rateBefore * 30)} → ${formatQty(f.rateAfter * 30)} szt / 30 d)`,
        value: Math.round(f.sales90),
        unit: "szt w 90 d",
        kind: "note",
      });
    }
    const sp = line.salesProfile;
    if (sp?.applied && sp.prosbaPieces > 0) {
      steps.push({
        key: "prosba_sales",
        label: "Sprzedaż pod prośby odjęta (zamawiana osobno z prośbą, nie na zapas)",
        value: Math.round(sp.prosbaPieces * 100) / 100,
        unit: "szt",
        kind: "note",
      });
    }
    if (line.stockoutAdjust) {
      const a = line.stockoutAdjust;
      steps.push({
        key: "stockout",
        label: `Sprzedaż przeliczona na dni ze stanem (${a.outDays} z ${a.recordedDays} dni bez towaru)`,
        value: Math.round(a.factor * 100) / 100,
        unit: "× sprzedaż",
        kind: "note",
      });
    }
    const celBase = Number(line.celZapasuTracked ?? line.celZapasu) || 0;
    const celSubiekt = Number(line.celZapasu) || 0;
    // Korekta za sprzedażą / historią zmienia cel — bez tego kroku „Cel” różni się od Subiekta bez powodu.
    if (line.celZapasuTracked != null && Math.abs(celBase - celSubiekt) >= 0.05) {
      steps.push({
        key: "cel_subiekt",
        label: `Cel przed korektą za sprzedażą (${celBase > celSubiekt ? "podbity" : "obniżony"} o ${formatQty(Math.abs(celBase - celSubiekt))} szt)`,
        value: Math.round(celSubiekt * 100) / 100,
        unit: "szt",
        kind: "note",
      });
    }
    const cel = Math.max(celBase, minStock);
    steps.push({
      key: "cel",
      label: minStock > celBase ? "Minimum stanów (wyższe niż cel)" : "Cel zapasu",
      // 2 miejsca: przy 30,04 − 30 „Brak 1” musi wynikać z widocznych liczb.
      value: Math.round(cel * 100) / 100,
      unit: "szt",
      kind: "base",
    });
    const stock = pair ? pair.coverSzt : Number(line.dostepne) || 0;
    steps.push({
      key: "stock",
      label: pair ? "Pokrycie pary (stan + otwarte ZD, w sztukach)" : "Dostępne (stan − rezerwacje)",
      value: stock,
      unit: "szt",
      kind: "minus",
    });
    const inTransit = pair ? 0 : Math.max(0, input.openZdPieces);
    if (inTransit > 0) {
      steps.push({ key: "zd", label: "W drodze (otwarte ZD)", value: inTransit, unit: "szt", kind: "minus" });
    }
    const shortage = ceilPos(cel - stock - inTransit);
    steps.push({ key: "short", label: "Brak do celu", value: shortage, unit: "szt", kind: "result" });
    if (extra > 0) {
      steps.push({
        key: "extra",
        label: input.extrasPolicy === "max" ? "Prośby (liczy się większe: brak albo prośby)" : "Prośby handlowców",
        value: extra,
        unit: "szt",
        kind: "plus",
      });
    }
    expected = input.extrasPolicy === "max" ? Math.max(shortage, extra) : shortage + extra;
  }

  const diff = qty.piecesNeeded - expected;
  if (diff !== 0 && !input.extraOnly) {
    steps.push({
      key: "adjust",
      // Kroki wyżej to uproszczenie; różnicę robią m.in. rezerwacje ZK pod prośby i komplety (BOM).
      label: "Korekta Kreatora (np. rezerwacje ZK pod prośby, komplety)",
      value: Math.abs(diff),
      unit: "szt",
      kind: diff > 0 ? "plus" : "minus",
    });
  }
  steps.push({ key: "need", label: "Potrzeba", value: qty.piecesNeeded, unit: "szt", kind: "result" });

  const label = qty.packageLabel.trim() || "op.";
  if (qty.hasPackaging && isPackagingPackagesMode(qty.documentUnitMode)) {
    const packs = qty.packsBeforeOrderMultiple ?? qty.zdUnits;
    steps.push({
      key: "packs",
      label: `Pełne opakowania (1 ${label} = ${qty.unitsPerPackage} szt)`,
      value: packs,
      unit: label,
      kind: "result",
    });
    if (qty.orderMultiple >= 2 && qty.zdUnits > 0) {
      steps.push({
        key: "pallets",
        label: `Pełne palety po ${qty.orderMultiple} (${qty.zdUnits / qty.orderMultiple} pal.)`,
        value: qty.zdUnits,
        unit: label,
        kind: "result",
      });
    }
  } else if (qty.hasPackaging) {
    steps.push({
      key: "pieces",
      label: `Sztuki zaokrąglone do pełnego opakowania (${qty.unitsPerPackage} szt)`,
      value: qty.zdUnits,
      unit: "szt",
      kind: "result",
    });
  }

  const override = input.overrideZdUnits;
  if (override != null && Number.isFinite(override) && Math.trunc(override) !== qty.zdUnits) {
    steps.push({
      key: "override",
      label: "Wpisane ręcznie — idzie na ZD",
      value: Math.trunc(override),
      unit: qty.hasPackaging && isPackagingPackagesMode(qty.documentUnitMode) ? label : "szt",
      kind: "note",
    });
  }
  return steps;
}
