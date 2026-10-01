"use client";

import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

export function ProductCatalogBulkAssignBar({
  selectedCount,
  visibleCount,
  allVisibleSelected,
  supplierId,
  suppliers,
  disabled,
  onSupplierChange,
  onSelectAllVisible,
  onClearSelection,
  onApply,
}: {
  selectedCount: number;
  visibleCount: number;
  allVisibleSelected: boolean;
  supplierId: string;
  suppliers: Array<{ id: string; name: string; subiektKhId: number | null }>;
  disabled?: boolean;
  onSupplierChange: (supplierId: string) => void;
  onSelectAllVisible: () => void;
  onClearSelection: () => void;
  onApply: () => void;
}) {
  const canApply = Boolean(supplierId) && selectedCount > 0 && !disabled;

  return (
    <div
      className={cn(
        "mb-3 rounded-lg border border-indigo-200/80 bg-indigo-50/75 px-3 py-2.5",
        "shadow-sm shadow-indigo-900/5"
      )}
      role="region"
      aria-label="Grupowe przypisanie dostawcy"
    >
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-indigo-950">
            {selectedCount === 1
              ? "1 zaznaczony produkt"
              : `${selectedCount} zaznaczonych produktów`}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-indigo-900/80">
            Wybrany dostawca stanie się głównym w katalogu dla zaznaczonych pozycji.
          </p>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            {visibleCount > 0 && !allVisibleSelected ? (
              <button
                type="button"
                className="font-medium text-indigo-700 underline-offset-2 hover:underline"
                onClick={onSelectAllVisible}
                disabled={disabled}
              >
                Zaznacz widoczne ({visibleCount})
              </button>
            ) : null}
            <button
              type="button"
              className="font-medium text-slate-600 underline-offset-2 hover:text-slate-800 hover:underline"
              onClick={onClearSelection}
              disabled={disabled}
            >
              Wyczyść zaznaczenie
            </button>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-[min(100%,14rem)] flex-1 sm:max-w-xs">
            <label className="mb-1 block text-[11px] font-medium text-indigo-950" htmlFor="bulk-supplier">
              Dostawca dla zaznaczonych
            </label>
            <Select
              id="bulk-supplier"
              value={supplierId}
              onChange={(e) => onSupplierChange(e.target.value)}
              disabled={disabled}
              className="h-9 w-full text-sm"
            >
              <option value="">— wybierz dostawcę —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.subiektKhId != null ? ` · kh ${s.subiektKhId}` : ""}
                </option>
              ))}
            </Select>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={!canApply}
            onClick={onApply}
            className="h-9 shrink-0 px-4"
          >
            Przypisz grupowo
          </Button>
        </div>
      </div>
    </div>
  );
}
