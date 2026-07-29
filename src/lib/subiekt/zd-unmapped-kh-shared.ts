/** Typy raportu niezmapowanych KH — bezpieczne dla klienta (bez Supabase). */

export type ZdUnmappedKhReason = "no_supplier_kh" | "supplier_exists_reindex";

export type ZdUnmappedKhRow = {
  subiektKhId: number;
  /** Nazwa kontrahenta z Subiekta (do wyszukiwania w programie). */
  kontrahentLabel: string | null;
  zdCount: number;
  sampleDocNumbers: string[];
  lastDocDate: string | null;
  reason: ZdUnmappedKhReason;
  /** Gdy reason = supplier_exists_reindex — dostawca z tym kh_Id w kartotece. */
  supplierHint: string | null;
};

export type KhSupplierSuggestionAction = "add_alias" | "reindex";

export type KhSupplierSuggestion = {
  supplierId: string;
  supplierName: string;
  score: number;
  reason: string;
  action: KhSupplierSuggestionAction;
};

export type ZdUnmappedKhRowWithSuggestion = ZdUnmappedKhRow & {
  suggestion: KhSupplierSuggestion | null;
};

export type ZdUnmappedKhReport = {
  rows: ZdUnmappedKhRowWithSuggestion[];
  totalUnmappedZd: number;
  indexedAt: string | null;
};
