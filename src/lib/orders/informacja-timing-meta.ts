import { formatPlDate } from "@/lib/display-labels";
import { parseDateOnly } from "@/lib/orders/dates";

export type InformacjaTimingMetaKind = "available" | "ordered_at_supplier";

export type InformacjaTimingMetaDisplay = {
  kind: InformacjaTimingMetaKind;
  caption: string;
  dateLabel: string;
  title: string;
};

const EMAIL_TIMING = /^E-mail\s+(\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4})/i;
const ORDERED_TIMING = /^Zamówione\s+(\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4})/i;

function parseInformacjaTimingDate(token: string): string | null {
  const trimmed = token.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return formatPlDate(trimmed);
  }
  const ddmmyyyy = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    const parsed = parseDateOnly(`${yyyy}-${mm}-${dd}`);
    return parsed ? formatPlDate(`${yyyy}-${mm}-${dd}`) : trimmed;
  }
  return trimmed;
}

export function buildInformacjaTimingMetaDisplay(
  timingLabel: string
): InformacjaTimingMetaDisplay | null {
  const raw = timingLabel.trim();
  if (!raw) return null;

  const emailMatch = raw.match(/^E-mail\s+(.+)$/i);
  if (emailMatch?.[1]) {
    const dateLabel = parseInformacjaTimingDate(emailMatch[1]);
    if (!dateLabel) return null;
    return {
      kind: "available",
      caption: "Dostępne od",
      dateLabel,
      title: `Magazyn potwierdził dostępność towaru ${dateLabel}`,
    };
  }

  const orderedMatch = raw.match(/^Zamówione\s+(.+)$/i);
  if (orderedMatch?.[1]) {
    const dateLabel = parseInformacjaTimingDate(orderedMatch[1]);
    if (!dateLabel) return null;
    return {
      kind: "ordered_at_supplier",
      caption: "Zamówione u dostawcy",
      dateLabel,
      title: `Zamówienie u dostawcy złożone ${dateLabel}`,
    };
  }

  return null;
}

type InformacjaTimingRow = {
  kind: string;
  timingLabel?: string | null;
};

export function shouldShowInformacjaTimingMeta(row: InformacjaTimingRow): boolean {
  if (row.kind !== "informacja") return false;
  const raw = row.timingLabel?.trim();
  if (!raw) return false;
  return EMAIL_TIMING.test(raw) || ORDERED_TIMING.test(raw);
}
