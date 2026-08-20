"use server";

import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import { requireZdEstimateAdmin } from "@/lib/auth";
import {
  IVOCLAR_CECHA_ID,
  IVOCLAR_CECHA_NAME,
  IVOCLAR_DEALER_NUMBER,
  IVOCLAR_REPORT_COPY,
  ivoclarReportFilename,
  parseIvoclarDateRange,
  previousCalendarMonthRange,
  previousCompleteIsoWeekRange,
  type IvoclarInventoryRow,
  type IvoclarInventorySummary,
  type IvoclarSelloutRow,
  type IvoclarSelloutSummary,
  type IvoclarFsFetchError,
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
import { resolveSubiektOrdersConfig } from "@/lib/subiekt/config";
import { todayDateKeyInWarsaw } from "@/lib/time/warsaw";

export type IvoclarReportBootstrapResult =
  | {
      ok: true;
      configured: boolean;
      configMessage: string | null;
      previousWeek: { dataOd: string; dataDo: string };
      previousMonth: { dataOd: string; dataDo: string };
      dealerNumber: string;
      cechaId: number;
      cechaName: string;
      copy: typeof IVOCLAR_REPORT_COPY;
      selloutFilename: string;
      inventoryFilename: string;
    }
  | { ok: false; message: string };

export async function actionIvoclarReportBootstrap(): Promise<IvoclarReportBootstrapResult> {
  await requireZdEstimateAdmin("read");
  try {
    const today = todayDateKeyInWarsaw();
    const previousWeek = previousCompleteIsoWeekRange(today);
    const previousMonth = previousCalendarMonthRange(today);
    const orders = resolveSubiektOrdersConfig();
    return {
      ok: true,
      configured: orders.ok,
      configMessage: orders.ok ? null : orders.message,
      previousWeek,
      previousMonth,
      dealerNumber: IVOCLAR_DEALER_NUMBER,
      cechaId: IVOCLAR_CECHA_ID,
      cechaName: IVOCLAR_CECHA_NAME,
      copy: IVOCLAR_REPORT_COPY,
      selloutFilename: ivoclarReportFilename("Sellout", previousWeek.dataDo),
      inventoryFilename: ivoclarReportFilename("Inventory", previousWeek.dataDo),
    };
  } catch (e) {
    return {
      ok: false,
      message: userFacingErrorText(e, "Nie udało się przygotować raportu Ivoclar."),
    };
  }
}

export type IvoclarInventoryActionResult =
  | {
      ok: true;
      rows: IvoclarInventoryRow[];
      summary: IvoclarInventorySummary;
      cechaId: number;
      inventoryFilename: string;
    }
  | { ok: false; message: string };

export async function actionFetchIvoclarInventory(): Promise<IvoclarInventoryActionResult> {
  await requireZdEstimateAdmin("read");
  const orders = resolveSubiektOrdersConfig();
  if (!orders.ok) {
    return { ok: false, message: orders.message };
  }
  try {
    const result = await fetchIvoclarInventoryCatalog();
    const today = todayDateKeyInWarsaw();
    return {
      ok: true,
      rows: result.rows,
      summary: result.summary,
      cechaId: result.cechaId,
      inventoryFilename: ivoclarReportFilename("Inventory", today),
    };
  } catch (e) {
    return {
      ok: false,
      message: userFacingErrorText(e, "Nie udało się pobrać stanów Ivoclar."),
    };
  }
}

export type IvoclarSelloutActionResult =
  | {
      ok: true;
      dataOd: string;
      dataDo: string;
      rows: IvoclarSelloutRow[];
      summary: IvoclarSelloutSummary;
      fetchErrors: IvoclarFsFetchError[];
      selloutFilename: string;
      inventoryFilename: string;
      inventoryRows: IvoclarInventoryRow[];
      inventorySummary: IvoclarInventorySummary;
      cechaId: number;
    }
  | { ok: false; message: string };

export async function actionFetchIvoclarSellout(input: {
  dataOd: string;
  dataDo: string;
}): Promise<IvoclarSelloutActionResult> {
  await requireZdEstimateAdmin("read");
  const orders = resolveSubiektOrdersConfig();
  if (!orders.ok) {
    return { ok: false, message: orders.message };
  }
  const range = parseIvoclarDateRange(input.dataOd, input.dataDo);
  if (!range.ok) {
    return { ok: false, message: range.error };
  }
  try {
    const inventory = await fetchIvoclarInventoryCatalog();
    const sellout = await fetchIvoclarSelloutFromFs({
      dataOd: range.dataOd,
      dataDo: range.dataDo,
      catalog: ivoclarLineCatalogFromRows(inventory.rows),
    });
    return {
      ok: true,
      dataOd: range.dataOd,
      dataDo: range.dataDo,
      rows: sellout.rows,
      summary: sellout.summary,
      fetchErrors: sellout.fetchErrors,
      selloutFilename: ivoclarReportFilename("Sellout", range.dataDo),
      inventoryFilename: ivoclarReportFilename("Inventory", range.dataDo),
      inventoryRows: inventory.rows,
      inventorySummary: inventory.summary,
      cechaId: inventory.cechaId,
    };
  } catch (e) {
    return {
      ok: false,
      message: userFacingErrorText(e, "Nie udało się pobrać sprzedaży FS Ivoclar."),
    };
  }
}

export type IvoclarXlsxExportResult =
  | {
      ok: true;
      filename: string;
      base64: string;
      exportedCount: number;
      skippedCount: number;
    }
  | { ok: false; message: string };

export async function actionExportIvoclarSelloutXlsx(input: {
  filename: string;
  rows: IvoclarSelloutRow[];
}): Promise<IvoclarXlsxExportResult> {
  await requireZdEstimateAdmin("read");
  try {
    const file = await buildIvoclarSelloutXlsx(input.rows, input.filename);
    if (file.exportedCount === 0) {
      return {
        ok: false,
        message: "Każdy wiersz musi mieć Country (ISO), Article, Quantity i PostalCode.",
      };
    }
    return {
      ok: true,
      filename: file.filename,
      base64: ivoclarXlsxToBase64(file.bytes),
      exportedCount: file.exportedCount,
      skippedCount: file.skippedCount,
    };
  } catch (e) {
    return {
      ok: false,
      message: userFacingErrorText(e, "Nie udało się zbudować pliku Sellout.xlsx."),
    };
  }
}

export async function actionExportIvoclarInventoryXlsx(input: {
  filename: string;
  rows: IvoclarInventoryRow[];
}): Promise<IvoclarXlsxExportResult> {
  await requireZdEstimateAdmin("read");
  try {
    const file = await buildIvoclarInventoryXlsx(input.rows, input.filename);
    if (file.exportedCount === 0) {
      return {
        ok: false,
        message: "Do xlsx wchodzą tylko SKU z numerem Article i stanem większym od 0.",
      };
    }
    return {
      ok: true,
      filename: file.filename,
      base64: ivoclarXlsxToBase64(file.bytes),
      exportedCount: file.exportedCount,
      skippedCount: file.skippedCount,
    };
  } catch (e) {
    return {
      ok: false,
      message: userFacingErrorText(e, "Nie udało się zbudować pliku Inventory.xlsx."),
    };
  }
}
