/**
 * Okno sprzedaży szacunku ZD (Data od / Data do).
 * „manual” = użytkownik ustawił daty ręcznie → nie nadpisuj z zapasu dostawcy.
 */

import { salesWindowFromDniZapasu } from "@/lib/orders/zd-estimate-manual";

export type ZdEstimateSalesWindowSource = "stock" | "manual";

export function shouldApplyStockSalesWindow(
  source: ZdEstimateSalesWindowSource
): boolean {
  return source === "stock";
}

/**
 * Po zmianie „Data do”:
 * - stock → przesuń Data od wg dniZapasu (okno spójne z zapasem)
 * - manual → zostaw Data od (nie kasuj ręcznego zakresu)
 */
export function nextDataOdAfterDataDoChange(input: {
  source: ZdEstimateSalesWindowSource;
  dataDo: string;
  dataOd: string;
  dniZapasu: number;
}): string {
  if (input.source === "manual") return input.dataOd;
  const n = Math.round(Number(input.dniZapasu));
  if (!Number.isFinite(n) || n < 1 || !input.dataDo.trim()) return input.dataOd;
  return salesWindowFromDniZapasu(n, input.dataDo).dataOd;
}

/** Ten sam łańcuch fallbacku co pole „Dni zapasu” przy launch. */
export function resolveLaunchDniZapasu(input: {
  supplierDniZapasu?: number | null;
  groupDniZapasu?: number | null;
  quickGroupDniZapasu?: number | null;
  defaultDni: number;
}): number {
  const pick = (v: number | null | undefined) =>
    v != null && Number.isFinite(v) && v >= 1 ? Math.round(v) : null;
  return (
    pick(input.supplierDniZapasu) ??
    pick(input.groupDniZapasu) ??
    pick(input.quickGroupDniZapasu) ??
    Math.max(1, Math.round(input.defaultDni))
  );
}
