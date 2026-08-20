import { createHash } from "crypto";
import { getISOWeek, getISOWeekYear } from "date-fns";
import {
  IVOCLAR_DATA_GAP_LABELS,
  IVOCLAR_REPORT_COPY,
  isBlockingSelloutDataGap,
  ivoclarReportFilename,
  ivoclarReportXlsxFilename,
  previousCompleteIsoWeekRange,
  tooManyFsHeadersMessage,
  type IvoclarDataGapCode,
  type IvoclarFsFetchError,
  type IvoclarInventoryRow,
  type IvoclarSelloutRow,
} from "@/lib/orders/ivoclar-report";
import {
  fetchIvoclarInventoryCatalog,
  fetchIvoclarSelloutFromFs,
  ivoclarLineCatalogFromRows,
} from "@/lib/orders/ivoclar-report-fetch";
import {
  buildIvoclarInventoryXlsx,
  buildIvoclarSelloutXlsx,
  ivoclarXlsxToBase64,
} from "@/lib/orders/ivoclar-report-xlsx";
import { parseDateOnly } from "@/lib/orders/dates";
import { resolveSubiektOrdersConfig } from "@/lib/subiekt/config";
import type { MailSendIssueSeverity } from "@/types/database";

export type IvoclarWeeklyPeriod = {
  periodKey: string;
  periodLabel: string;
  dataOd: string;
  dataDo: string;
};

export type IvoclarWeeklyArtifactsErrorCode =
  | "subiekt_offline"
  | "config"
  | "fetch"
  | "fs_header_overflow";

export type IvoclarWeeklyIssue = {
  severity: MailSendIssueSeverity;
  code: string;
  message: string;
  context: Record<string, unknown>;
  count: number;
};

export type IvoclarWeeklyArtifacts = {
  period: IvoclarWeeklyPeriod;
  selloutRows: IvoclarSelloutRow[];
  inventoryRows: IvoclarInventoryRow[];
  selloutFile: { filename: string; bytes: Uint8Array; exportedCount: number; skippedCount: number };
  inventoryFile: { filename: string; bytes: Uint8Array; exportedCount: number; skippedCount: number };
  fetchErrors: IvoclarFsFetchError[];
  issues: IvoclarWeeklyIssue[];
};

export function computeIvoclarWeeklyPeriod(todayDateKey: string): IvoclarWeeklyPeriod {
  const range = previousCompleteIsoWeekRange(todayDateKey);
  const dataDoDate = parseDateOnly(range.dataDo)!;
  const isoYear = getISOWeekYear(dataDoDate);
  const isoWeek = getISOWeek(dataDoDate);
  const periodKey = `${isoYear}-W${String(isoWeek).padStart(2, "0")}`;
  const periodLabel = `${range.dataOd} – ${range.dataDo} (${periodKey})`;
  return {
    periodKey,
    periodLabel,
    dataOd: range.dataOd,
    dataDo: range.dataDo,
  };
}

export function ivoclarWeeklyPeriodKeyForTrigger(
  period: IvoclarWeeklyPeriod,
  trigger: "cron" | "manual" | "test"
): string {
  if (trigger === "test") return `${period.periodKey}:test`;
  return period.periodKey;
}

export function forcedIvoclarWeeklyPeriodKey(
  period: IvoclarWeeklyPeriod,
  at = new Date()
): string {
  return `${period.periodKey}:manual-force:${at.toISOString()}`;
}

function gapSeverity(code: IvoclarDataGapCode): MailSendIssueSeverity {
  return isBlockingSelloutDataGap(code) ? "blocking" : "warning";
}

export function collectIvoclarIssues(input: {
  selloutRows: IvoclarSelloutRow[];
  fetchErrors: IvoclarFsFetchError[];
  selloutSkippedCount: number;
  inventorySkippedCount: number;
  fsHeaderCount?: number;
}): IvoclarWeeklyIssue[] {
  const gapCounts = new Map<string, { code: IvoclarDataGapCode; count: number; samples: string[] }>();

  for (const row of input.selloutRows) {
    for (const gap of row.dataGaps) {
      const existing = gapCounts.get(gap);
      if (existing) {
        existing.count += 1;
        if (existing.samples.length < 5) existing.samples.push(row.dokNr);
      } else {
        gapCounts.set(gap, { code: gap, count: 1, samples: [row.dokNr] });
      }
    }
  }

  const issues: IvoclarWeeklyIssue[] = [];

  for (const { code, count, samples } of gapCounts.values()) {
    issues.push({
      severity: gapSeverity(code),
      code,
      message: IVOCLAR_DATA_GAP_LABELS[code],
      context: { samples },
      count,
    });
  }

  if (input.selloutSkippedCount > 0) {
    issues.push({
      severity: "warning",
      code: "sellout_rows_skipped",
      message: "Część wierszy Sellout pominięta w eksporcie (brak Country/Postal/Article).",
      context: {},
      count: input.selloutSkippedCount,
    });
  }

  if (input.inventorySkippedCount > 0) {
    issues.push({
      severity: "info",
      code: "inventory_rows_skipped",
      message: "SKU pominięte w Inventory (stan 0 lub brak Article).",
      context: {},
      count: input.inventorySkippedCount,
    });
  }

  for (const err of input.fetchErrors) {
    issues.push({
      severity: "warning",
      code: "fs_fetch_error",
      message: err.message,
      context: { dokId: err.dokId, dokNr: err.dokNr },
      count: 1,
    });
  }

  if (
    input.fsHeaderCount != null &&
    input.fsHeaderCount > 1200
  ) {
    issues.push({
      severity: "blocking",
      code: "fs_header_overflow",
      message: tooManyFsHeadersMessage(input.fsHeaderCount),
      context: { fsHeaderCount: input.fsHeaderCount },
      count: 1,
    });
  }

  return issues.sort((a, b) => {
    const order = { blocking: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity] || a.code.localeCompare(b.code);
  });
}

export function renderIvoclarWeeklyEmailHtml(input: {
  period: IvoclarWeeklyPeriod;
  selloutExported: number;
  inventoryExported: number;
  issues: IvoclarWeeklyIssue[];
}): string {
  const warningCount = input.issues.filter((i) => i.severity !== "info").length;
  const issueLines =
    input.issues.length === 0
      ? "<p>Brak uwag do danych.</p>"
      : `<ul>${input.issues
          .slice(0, 12)
          .map(
            (i) =>
              `<li><strong>${i.severity}</strong> ${i.message}${i.count > 1 ? ` (${i.count})` : ""}</li>`
          )
          .join("")}</ul>`;

  return `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#1e293b">
<h1>Raport Ivoclar — ${input.period.periodLabel}</h1>
<p>Okres sprzedaży: <strong>${input.period.dataOd}</strong> – <strong>${input.period.dataDo}</strong> (pn–nd).</p>
<p>Sellout: <strong>${input.selloutExported}</strong> wierszy · Inventory: <strong>${input.inventoryExported}</strong> SKU.</p>
<p style="color:#64748b;font-size:14px">${IVOCLAR_REPORT_COPY.inventoryNote}</p>
${
  warningCount > 0
    ? `<p style="color:#b45309"><strong>Uwaga:</strong> ${warningCount} kategorii braków/ostrzeżeń — szczegóły w załącznikach i panelu OnTime.</p>`
    : ""
}
<h2>Podsumowanie braków</h2>
${issueLines}
<p style="color:#94a3b8;font-size:12px;margin-top:24px">Wysłano automatycznie z OnTime.</p>
</body></html>`;
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function buildIvoclarWeeklyArtifacts(
  todayDateKey: string
): Promise<
  | { ok: true; artifacts: IvoclarWeeklyArtifacts }
  | { ok: false; error: string; code: IvoclarWeeklyArtifactsErrorCode }
> {
  const orders = resolveSubiektOrdersConfig();
  if (!orders.ok) {
    return { ok: false, error: orders.message, code: "config" };
  }

  const period = computeIvoclarWeeklyPeriod(todayDateKey);

  let inventory;
  try {
    inventory = await fetchIvoclarInventoryCatalog();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Subiekt niedostępny";
    if (/subiekt|offline|fetch|ECONNREFUSED|timeout/i.test(message)) {
      return { ok: false, error: message, code: "subiekt_offline" };
    }
    return { ok: false, error: message, code: "fetch" };
  }

  let sellout;
  try {
    sellout = await fetchIvoclarSelloutFromFs({
      dataOd: period.dataOd,
      dataDo: period.dataDo,
      catalog: ivoclarLineCatalogFromRows(inventory.rows),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Błąd pobierania FS";
    if (/faktur FS|zawęź daty|limit 1200/i.test(message)) {
      return { ok: false, error: message, code: "fs_header_overflow" };
    }
    if (/subiekt|offline|fetch|ECONNREFUSED|timeout/i.test(message)) {
      return { ok: false, error: message, code: "subiekt_offline" };
    }
    return { ok: false, error: message, code: "fetch" };
  }

  const selloutFilename = ivoclarReportXlsxFilename("Sellout", period.dataDo);
  const inventoryFilename = ivoclarReportXlsxFilename("Inventory", period.dataDo);

  const selloutBuilt = await buildIvoclarSelloutXlsx(sellout.rows, selloutFilename);
  const inventoryBuilt = await buildIvoclarInventoryXlsx(inventory.rows, inventoryFilename);

  const issues = collectIvoclarIssues({
    selloutRows: sellout.rows,
    fetchErrors: sellout.fetchErrors,
    selloutSkippedCount: selloutBuilt.skippedCount,
    inventorySkippedCount: inventoryBuilt.skippedCount,
    fsHeaderCount: sellout.summary.fsHeaderCount,
  });

  return {
    ok: true,
    artifacts: {
      period,
      selloutRows: sellout.rows,
      inventoryRows: inventory.rows,
      selloutFile: {
        filename: selloutBuilt.filename,
        bytes: selloutBuilt.bytes,
        exportedCount: selloutBuilt.exportedCount,
        skippedCount: selloutBuilt.skippedCount,
      },
      inventoryFile: {
        filename: inventoryBuilt.filename,
        bytes: inventoryBuilt.bytes,
        exportedCount: inventoryBuilt.exportedCount,
        skippedCount: inventoryBuilt.skippedCount,
      },
      fetchErrors: sellout.fetchErrors,
      issues,
    },
  };
}

export function ivoclarAttachmentManifest(
  sellout: IvoclarWeeklyArtifacts["selloutFile"],
  inventory: IvoclarWeeklyArtifacts["inventoryFile"]
) {
  return [
    {
      name: sellout.filename,
      bytes: sellout.bytes.byteLength,
      sha256: sha256Hex(sellout.bytes),
    },
    {
      name: inventory.filename,
      bytes: inventory.bytes.byteLength,
      sha256: sha256Hex(inventory.bytes),
    },
  ];
}

export function ivoclarWeeklyEmailSubject(period: IvoclarWeeklyPeriod): string {
  return `Ivoclar weekly — ${period.periodLabel}`;
}

export { ivoclarReportFilename, ivoclarXlsxToBase64 };
