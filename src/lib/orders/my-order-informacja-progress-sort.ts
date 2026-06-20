import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { parseDateOnly } from "@/lib/orders/dates";
import { rowNeedsSalesAction } from "@/lib/orders/my-order-inbox-filter";
import { sortMyOrderRows } from "@/lib/orders/my-order-sales-ui";

const EMAIL_TIMING = /^E-mail\s+(\d{2})\.(\d{2})\.(\d{4})/i;

/** Data wysłania e-maila z magazynu (informacja gotowa do potwierdzenia). */
export function informacjaEmailSentAt(row: MyOrderRow): number | null {
  const raw = row.timingLabel?.trim();
  if (!raw) return null;
  const match = raw.match(EMAIL_TIMING);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const parsed = parseDateOnly(`${yyyy}-${mm}-${dd}`);
  return parsed?.getTime() ?? null;
}

/**
 * Sekcja informacji: najpierw prośby do potwierdzenia (najświeższy e-mail u góry),
 * potem pozostałe wg standardowej kolejności.
 */
export function sortInformacjaProgressRows(rows: MyOrderRow[]): MyOrderRow[] {
  const ack: MyOrderRow[] = [];
  const rest: MyOrderRow[] = [];
  for (const row of rows) {
    if (row.acknowledgeMode === "availability" && rowNeedsSalesAction(row)) {
      ack.push(row);
    } else {
      rest.push(row);
    }
  }

  ack.sort((a, b) => {
    const ta = informacjaEmailSentAt(a);
    const tb = informacjaEmailSentAt(b);
    if (ta != null && tb != null && ta !== tb) return tb - ta;
    if (ta != null && tb == null) return -1;
    if (ta == null && tb != null) return 1;
    return b.submittedLabel.localeCompare(a.submittedLabel, "pl");
  });

  return [...ack, ...sortMyOrderRows(rest)];
}
