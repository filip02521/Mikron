/** Stany jobów ZD — bezpieczne dla klienta (bez I/O). */

export type ZdImportSupplierJobState = {
  status: "idle" | "running" | "paused" | "done" | "failed";
  supplierId: string;
  supplierName: string;
  subiektKhId: number;
  dataOd: string;
  indexOffset: number;
  indexTotalDocs: number | null;
  batchDocs: number;
  processedDocs: number;
  processedLines: number;
  uniqueProductsSeen: number;
  linksUpserted: number;
  lastDocNumber: string | null;
  lastUpdatedAt: string;
  lastError: string | null;
};

export type ZdImportAllSuppliersJobState = {
  status: "idle" | "running" | "paused" | "done" | "failed";
  dataOd: string;
  supplierIds: string[];
  supplierIndex: number;
  supplierId: string | null;
  supplierName: string | null;
  indexOffset: number;
  indexTotalDocs: number | null;
  batchDocs: number;
  processedSuppliers: number;
  processedDocs: number;
  processedLines: number;
  linksUpserted: number;
  lastDocNumber: string | null;
  lastUpdatedAt: string;
  lastError: string | null;
};

export type ZdIndexJobState = {
  status: "idle" | "running" | "paused" | "done" | "failed";
  dataOd: string;
  page: number;
  pageSize: number;
  totalPages: number | null;
  processed: number;
  mapped: number;
  unmapped: number;
  unverifiable: number;
  lastDocNumber: string | null;
  lastUpdatedAt: string;
  lastError: string | null;
};
