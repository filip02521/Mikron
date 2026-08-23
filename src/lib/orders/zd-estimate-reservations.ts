import type {
  SubiektZdEstimateLine,
  SubiektZdEstimateZkLine,
} from "@/lib/subiekt/types";

/** Max stron przy dociąganiu listy ZK (pageSize 100 → do 3000 wierszy API). */
export const ZD_ESTIMATE_ZK_RESERVATIONS_MAX_PAGES = 30;
export const ZD_ESTIMATE_ZK_RESERVATIONS_PAGE_SIZE = 100;

export type ZdEstimateReservedZkRow = {
  dokId: number;
  zkNumber: string;
  status: number | null;
  /** Krótka etykieta PL (np. „Zarezerwowany”). */
  statusLabel: string;
  /** Opis statusu ze słownika API (`dok_StatusOpis`). */
  statusDescription: string | null;
  issuedAt: string | null;
  /** Główna nazwa klienta (`adr_Nazwa`). */
  clientLabel: string;
  /** Symbol kontrahenta, gdy różni się od nazwy (`kh_Symbol`). */
  clientSymbol: string | null;
  /** kh_Id odbiorcy (`dok_OdbiorcaId`) — match do prośby. */
  clientKhId: number | null;
  quantity: number;
  lineId: number | null;
};

/** Czytelna etykieta statusu ZK z nazwy API / kodu. */
export function formatZdEstimateZkStatusLabel(
  statusNazwa: string | null | undefined,
  status: number | null | undefined
): string {
  const raw = String(statusNazwa ?? "").trim();
  const normalized = raw.toLowerCase();
  if (normalized === "zarezerwowany") return "Zarezerwowany";
  if (normalized === "bezrezerwacji" || normalized === "bez rezerwacji") {
    return "Bez rezerwacji";
  }
  if (normalized === "zamniezr") return "Niezrealizowane";
  if (raw) {
    // CamelCase API → spacje: BezRezerwacji już obsłużone; inne zostaw.
    const spaced = raw
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\s+/g, " ")
      .trim();
    if (spaced) return spaced;
  }
  if (status === 7) return "Zarezerwowany";
  if (status === 6 || status === 5) return "Bez rezerwacji";
  if (status != null) return `Status ${status}`;
  return "—";
}

/** ZK ze statusem 7 albo jawnym `bezRezerwacji === false`. */
export function isZdEstimateZkReservedLine(
  line: Pick<SubiektZdEstimateZkLine, "dok_Status" | "bezRezerwacji">
): boolean {
  if (line.bezRezerwacji === false) return true;
  const status = Math.trunc(Number(line.dok_Status));
  return status === 7;
}

export function mapZdEstimateZkLineToReservedRow(
  line: SubiektZdEstimateZkLine
): ZdEstimateReservedZkRow | null {
  if (!isZdEstimateZkReservedLine(line)) return null;

  const dokId = Math.trunc(Number(line.dok_Id));
  if (!Number.isFinite(dokId) || dokId <= 0) return null;

  const quantity = Number(line.ob_Ilosc);
  const qty = Number.isFinite(quantity) ? quantity : 0;
  const zkNumber =
    String(line.dok_NrPelny ?? "").trim() ||
    (line.dok_Nr != null ? `ZK #${line.dok_Nr}` : `ZK #${dokId}`);
  const clientFromName = String(line.adr_Nazwa ?? "").trim();
  const clientFromSymbol = String(line.kh_Symbol ?? "").trim();
  const status = Number.isFinite(Number(line.dok_Status))
    ? Math.trunc(Number(line.dok_Status))
    : null;
  const statusLabel = formatZdEstimateZkStatusLabel(line.dok_StatusNazwa, status);
  const statusDescription = String(line.dok_StatusOpis ?? "").trim() || null;
  const lineIdRaw = Math.trunc(Number(line.ob_Id));
  const clientLabel = clientFromName || clientFromSymbol || "—";
  const clientSymbol =
    clientFromSymbol &&
    clientFromName &&
    clientFromSymbol.toLowerCase() !== clientFromName.toLowerCase()
      ? clientFromSymbol
      : null;
  const clientKhRaw = Math.trunc(Number(line.dok_OdbiorcaId));
  const clientKhId =
    Number.isFinite(clientKhRaw) && clientKhRaw > 0 ? clientKhRaw : null;

  return {
    dokId,
    zkNumber,
    status,
    statusLabel,
    statusDescription,
    issuedAt: line.dok_DataWyst ? String(line.dok_DataWyst) : null,
    clientLabel,
    clientSymbol,
    clientKhId,
    quantity: qty,
    lineId: Number.isFinite(lineIdRaw) && lineIdRaw > 0 ? lineIdRaw : null,
  };
}

export function collectZdEstimateReservedZkRows(
  lines: SubiektZdEstimateZkLine[]
): ZdEstimateReservedZkRow[] {
  const rows: ZdEstimateReservedZkRow[] = [];
  for (const line of lines) {
    const row = mapZdEstimateZkLineToReservedRow(line);
    if (row) rows.push(row);
  }
  return rows;
}

export function sumZdEstimateReservedZkQuantity(
  rows: Array<Pick<ZdEstimateReservedZkRow, "quantity">>
): number {
  return rows.reduce((sum, row) => sum + (Number.isFinite(row.quantity) ? row.quantity : 0), 0);
}

export function sortZdEstimateReservedZkRows(
  rows: ZdEstimateReservedZkRow[]
): ZdEstimateReservedZkRow[] {
  return [...rows].sort((a, b) => {
    const da = a.issuedAt ?? "";
    const db = b.issuedAt ?? "";
    if (da !== db) return db.localeCompare(da);
    return b.dokId - a.dokId || a.zkNumber.localeCompare(b.zkNumber, "pl");
  });
}

/** Dociąga wszystkie strony zarezerwowanych ZK dla towaru. */
export async function fetchAllReservedZkRowsForTwId(input: {
  twId: number;
  fetchPage: (args: {
    towarId: number;
    tylkoBezRez: boolean;
    page: number;
    pageSize: number;
  }) => Promise<{
    data: { podsumowanie?: unknown; pozycje?: SubiektZdEstimateZkLine[] } | null;
    pagination?: { totalPages?: number | null } | null;
  }>;
  maxPages?: number;
  pageSize?: number;
}): Promise<{
  rows: ZdEstimateReservedZkRow[];
  truncated: boolean;
  scannedApiRows: number;
  summary: ZdEstimateReservationsSummary | null;
}> {
  const twId = Math.trunc(Number(input.twId));
  const maxPages = Math.max(
    1,
    Math.trunc(Number(input.maxPages) || ZD_ESTIMATE_ZK_RESERVATIONS_MAX_PAGES)
  );
  const pageSize = Math.max(
    1,
    Math.trunc(Number(input.pageSize) || ZD_ESTIMATE_ZK_RESERVATIONS_PAGE_SIZE)
  );

  const reserved: ZdEstimateReservedZkRow[] = [];
  let summary: ZdEstimateReservationsSummary | null = null;
  let scannedApiRows = 0;
  let truncated = false;
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= maxPages) {
    const { data, pagination } = await input.fetchPage({
      towarId: twId,
      tylkoBezRez: false,
      page,
      pageSize,
    });

    if (!summary) {
      summary =
        mapZdEstimateZkPodsumowanie(
          data?.podsumowanie as SubiektZdEstimateLine | null | undefined
        ) ?? {
          twId,
          symbol: "",
          name: "",
          stanRez: 0,
          otwarteZkZarezerwowane: 0,
          otwarteZkBezRez: 0,
        };
    }

    const batch = data?.pozycje ?? [];
    scannedApiRows += batch.length;
    reserved.push(...collectZdEstimateReservedZkRows(batch));

    totalPages = Math.max(1, Math.trunc(Number(pagination?.totalPages) || 1));
    if (page >= totalPages) break;
    page += 1;
  }

  if (page > maxPages && page <= totalPages) {
    truncated = true;
  }

  return {
    rows: sortZdEstimateReservedZkRows(reserved),
    truncated,
    scannedApiRows,
    summary,
  };
}

export type ZdEstimateReservationsSummary = {
  twId: number;
  symbol: string;
  name: string;
  stanRez: number;
  otwarteZkZarezerwowane: number;
  otwarteZkBezRez: number;
};

export function mapZdEstimateZkPodsumowanie(
  line: SubiektZdEstimateLine | null | undefined
): ZdEstimateReservationsSummary | null {
  if (!line) return null;
  const twId = Math.trunc(Number(line.tw_Id));
  if (!Number.isFinite(twId) || twId <= 0) return null;
  return {
    twId,
    symbol: String(line.tw_Symbol ?? "").trim(),
    name: String(line.tw_Nazwa ?? "").trim(),
    stanRez: Number(line.tw_StanRez) || 0,
    otwarteZkZarezerwowane: Number(line.otwarteZkZarezerwowane) || 0,
    otwarteZkBezRez: Number(line.otwarteZkBezRez) || 0,
  };
}
