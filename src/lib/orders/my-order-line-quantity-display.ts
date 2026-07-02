import { groupTeethDetails } from "@/lib/teeth/teeth-catalog";
import type { MyOrderLine } from "@/lib/orders/my-order-presenter";

const ALL_ON_STOCK_PROGRESS = /^wszystkie \d+ szt\.?$/;
const WAREHOUSE_PROGRESS = /^\d+\s*z\s*\d+/i;

/** Adnotacja o częściowym wycofaniu z quantityLabel, np. „(z 6 · 3 wycofane)”. */
export function lineWithdrawalQuantityNote(
  quantityLabel: string | null | undefined
): string | null {
  const match = quantityLabel?.trim().match(/\(z .+ wycofane\)/);
  return match?.[0] ?? null;
}

function allOnStockProgressMatchesQuantity(
  progressLabel: string,
  quantityLabel: string
): boolean {
  const match = progressLabel.trim().match(/^wszystkie (\d+) szt\.?$/);
  if (!match) return false;
  const n = match[1];
  return (
    quantityLabel.trim() === `${n} szt.` ||
    quantityLabel.trim().startsWith(`${n} szt. `)
  );
}

/** Chipy zębów pokazują × N — nagłówek nie musi powtarzać sztuk. */
export function teethChipsShowQuantityBreakdown(
  line: Pick<MyOrderLine, "teethDetails">
): boolean {
  if (!line.teethDetails?.length) return false;
  const groups = groupTeethDetails(line.teethDetails);
  if (groups.length === 0) return false;
  return (
    groups.some((g) => g.count > 1) ||
    groups.length > 1 ||
    line.teethDetails.length > 1
  );
}

/** Jedna ilość w rozwiniętej pozycji — bez potrójnego „3 szt.” / „wszystkie 3 szt.” / „× 3”. */
export function resolveExpandedLineQuantityDisplay(
  line: Pick<MyOrderLine, "quantityLabel" | "progressLabel" | "teethDetails">,
  opts: {
    compact: boolean;
    showProgress: boolean;
    /** Magazyn grupy w „Szczegółach” — nie powtarzaj „0 z 3 szt.” przy każdym produkcie. */
    hideWarehouseProgress?: boolean;
  }
): {
  /** Obok nazwy produktu — pełna ilość lub sama adnotacja o wycofaniu. */
  quantityLabel: string | null;
  /** Wiersz szczegółów pod tytułem (progressLabel). */
  progressInDetail: string | null;
} {
  const quantityRaw = line.quantityLabel?.trim() || null;
  const progressRaw = line.progressLabel?.trim() || null;
  const showProgressDetail = opts.showProgress && progressRaw;

  if (!opts.compact) {
    return {
      quantityLabel: quantityRaw,
      progressInDetail: showProgressDetail ? progressRaw : null,
    };
  }

  const withdrawalNote = lineWithdrawalQuantityNote(quantityRaw);
  const teethBreakdown = teethChipsShowQuantityBreakdown(line);

  let progressInDetail: string | null = showProgressDetail ? progressRaw : null;
  if (
    opts.hideWarehouseProgress &&
    progressInDetail &&
    WAREHOUSE_PROGRESS.test(progressInDetail)
  ) {
    progressInDetail = null;
  }
  if (
    progressInDetail &&
    quantityRaw &&
    (ALL_ON_STOCK_PROGRESS.test(progressInDetail) ||
      allOnStockProgressMatchesQuantity(progressInDetail, quantityRaw))
  ) {
    progressInDetail = null;
  }

  if (line.teethDetails?.length && teethBreakdown) {
    return {
      quantityLabel: withdrawalNote,
      progressInDetail,
    };
  }

  if (
    progressInDetail &&
    quantityRaw &&
    allOnStockProgressMatchesQuantity(progressInDetail, quantityRaw)
  ) {
    progressInDetail = null;
  }

  return {
    quantityLabel: quantityRaw,
    progressInDetail,
  };
}
