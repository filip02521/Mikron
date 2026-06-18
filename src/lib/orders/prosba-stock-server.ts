import type { IndividualRequestKind } from "@/types/database";
import { parseOrderQuantity } from "@/lib/orders/individual";
import {
  assessProsbaLineStock,
  stockSnapshotFromLineDraft,
  PROSBA_STOCK_ACK_REQUIRED_HINT,
  type ProsbaLineStockSnapshot,
} from "@/lib/orders/prosba-stock-check";
import { fetchProsbaLineStock } from "@/lib/orders/fetch-prosba-line-stock";

export const PROSBA_STOCK_ACK_REQUIRED_CODE = "PROSBA_SUFFICIENT_STOCK_ACK_REQUIRED";

export type ProsbaStockServerLine = {
  product?: string;
  symbol?: string;
  mikranCode?: string;
  quantity?: string;
  subiektTwId?: number | null;
  onHand?: number | null;
  reserved?: number | null;
  available?: number | null;
  stockSource?: "subiekt" | null;
};

export class ProsbaSufficientStockError extends Error {
  readonly code = PROSBA_STOCK_ACK_REQUIRED_CODE;

  constructor(readonly sufficientLines: ProsbaStockServerLine[]) {
    super(formatProsbaServerStockRejectMessage(sufficientLines));
    this.name = "ProsbaSufficientStockError";
  }
}

export function formatProsbaServerStockRejectMessage(lines: ProsbaStockServerLine[]): string {
  const names = lines.map((line) => {
    const name = line.product?.trim() || line.symbol?.trim() || line.mikranCode?.trim() || "Produkt";
    const qty = line.quantity?.trim() || "?";
    const avail = line.available;
    const availPart = avail != null && Number.isFinite(avail) ? ` (stan: ${avail} szt.)` : "";
    return `• ${name} — ${qty} szt.${availPart}`;
  });
  return `Część pozycji ma wystarczający stan magazynowy w Subiekcie:\n\n${names.join("\n")}\n\n${PROSBA_STOCK_ACK_REQUIRED_HINT} lub odśwież dane magazynowe.`;
}

function stockSnapshotForServerLine(
  line: ProsbaStockServerLine,
  stockByTwId: Record<number, ProsbaLineStockSnapshot>
): ProsbaLineStockSnapshot | null {
  const twId = line.subiektTwId;
  if (twId != null && twId > 0) {
    const fromFetch = stockByTwId[Math.trunc(twId)];
    if (fromFetch) return fromFetch;
  }
  return stockSnapshotFromLineDraft(line);
}

export async function findProsbaLinesWithSufficientStock(input: {
  lines: ProsbaStockServerLine[];
  requestKind: IndividualRequestKind;
  stockByTwId?: Record<number, ProsbaLineStockSnapshot>;
}): Promise<ProsbaStockServerLine[]> {
  const { lines, requestKind } = input;
  if (requestKind !== "zamowienie") return [];

  const twIds = [
    ...new Set(
      lines
        .map((line) => line.subiektTwId)
        .filter((id): id is number => id != null && id > 0)
        .map((id) => Math.trunc(id))
    ),
  ];

  const stockByTwId =
    input.stockByTwId ?? (twIds.length ? await fetchProsbaLineStock(twIds) : {});

  const sufficient: ProsbaStockServerLine[] = [];

  for (const line of lines) {
    const twId = line.subiektTwId;
    if (twId == null || twId <= 0) continue;

    const requestedQty = parseOrderQuantity(line.quantity ?? "");
    if (requestedQty == null || requestedQty <= 0) continue;

    const snap = stockSnapshotForServerLine(line, stockByTwId);
    if (!snap) continue;

    const lineWithAvail =
      line.available == null && snap.available != null
        ? { ...line, available: snap.available }
        : line;

    if (
      assessProsbaLineStock({ requestedQty, stock: snap }) === "sufficient"
    ) {
      sufficient.push(lineWithAvail);
    }
  }

  return sufficient;
}

/**
 * Serwerowa kontrola przed zapisem prośby o zamówienie.
 * Gdy Subiekt nie zwróci danych — nie blokuje (jak UI). Wymaga jawnego ack po confirmie w formularzu.
 */
export async function assertProsbaSubmitStockAllowed(input: {
  lines: ProsbaStockServerLine[];
  requestKind: IndividualRequestKind;
  acknowledgeSufficientStock?: boolean;
}): Promise<void> {
  const { lines, requestKind, acknowledgeSufficientStock } = input;
  if (requestKind !== "zamowienie") return;

  const sufficientLines = await findProsbaLinesWithSufficientStock({ lines, requestKind });

  if (!sufficientLines.length) return;

  if (acknowledgeSufficientStock) {
    console.info("[prosba-stock] Zapis prośby mimo wystarczającego stanu magazynowego", {
      lineCount: sufficientLines.length,
      products: sufficientLines.map(
        (line) => line.product?.trim() || line.symbol?.trim() || line.mikranCode?.trim() || "?"
      ),
    });
    return;
  }

  throw new ProsbaSufficientStockError(sufficientLines);
}
