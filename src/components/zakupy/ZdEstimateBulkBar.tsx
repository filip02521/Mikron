"use client";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { ZD_ESTIMATE_BULK_MAX } from "@/lib/orders/zd-estimate-bulk";
import { ZD_BOM_UI } from "@/lib/orders/zd-estimate-bom-copy";

export function ZdEstimateBulkBar({
  selectedCount,
  visibleCount,
  allVisibleSelected,
  excludeEligibleCount,
  restoreEligibleCount,
  packagingClearEligibleCount,
  truncatedHint,
  disabled,
  onSelectAllVisible,
  onClearSelection,
  onBulkExclude,
  onBulkRestore,
  onBulkPackaging,
  onBulkClearPackaging,
  onCreatePair,
  onCreateBom,
}: {
  selectedCount: number;
  visibleCount: number;
  allVisibleSelected: boolean;
  /** Zaznaczone, które jeszcze nie są wykluczone (lub wszystkie — upsert). */
  excludeEligibleCount: number;
  restoreEligibleCount: number;
  packagingClearEligibleCount: number;
  truncatedHint?: boolean;
  disabled?: boolean;
  onSelectAllVisible: () => void;
  onClearSelection: () => void;
  onBulkExclude: () => void;
  onBulkRestore: () => void;
  onBulkPackaging: () => void;
  onBulkClearPackaging: () => void;
  /** Dokładnie 2 zaznaczone → otwórz formularz pary. */
  onCreatePair?: () => void;
  /** ≥2 zaznaczone → otwórz formularz składu (wskaż zestaw). */
  onCreateBom?: () => void;
}) {
  if (selectedCount <= 0) return null;

  return (
    <div
      className={cn(
        "sticky top-0 z-20 rounded-xl border border-indigo-200/80 bg-indigo-50/95 px-3.5 py-3 shadow-sm shadow-indigo-900/5 backdrop-blur-md",
        "sm:px-4"
      )}
      role="region"
      aria-label="Akcje grupowe zaznaczonych produktów"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-indigo-950">
            <span
              className="inline-flex size-6 items-center justify-center rounded-full bg-indigo-200/80 text-xs font-bold tabular-nums text-indigo-900"
              aria-hidden
            >
              {selectedCount}
            </span>
            {selectedCount === 1
              ? "zaznaczony produkt"
              : "zaznaczonych produktów"}
            {truncatedHint ? (
              <span className="text-xs font-medium text-amber-800">
                · max {ZD_ESTIMATE_BULK_MAX} na akcję
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-indigo-900/75">
            Wykluczenia i opakowania zapiszą się trwale dla całego działu.
          </p>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            {visibleCount > 0 && !allVisibleSelected ? (
              <button
                type="button"
                className="font-medium text-indigo-700 underline-offset-2 hover:underline disabled:opacity-50"
                onClick={onSelectAllVisible}
                disabled={disabled}
              >
                Zaznacz widoczne ({visibleCount})
              </button>
            ) : null}
            <button
              type="button"
              className="font-medium text-slate-600 underline-offset-2 hover:text-slate-800 hover:underline disabled:opacity-50"
              onClick={onClearSelection}
              disabled={disabled}
            >
              Odznacz
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onCreatePair ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={disabled || selectedCount !== 2}
              onClick={onCreatePair}
              title={
                selectedCount === 2
                  ? "Utwórz parę montaż/demontaż z zaznaczonych"
                  : "Zaznacz dokładnie 2 towary, żeby utworzyć parę"
              }
            >
              Para
            </Button>
          ) : null}
          {onCreateBom ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={disabled || selectedCount < 2}
              onClick={onCreateBom}
              title={
                selectedCount >= 2
                  ? ZD_BOM_UI.bulkTitleReady
                  : ZD_BOM_UI.bulkTitleNeed
              }
            >
              {ZD_BOM_UI.bulkButton}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={disabled || selectedCount === 0}
            onClick={onBulkPackaging}
            title="Ustaw te same opakowanie dla zaznaczonych (np. 10 szt / op.)"
          >
            Opakowanie
          </Button>
          {packagingClearEligibleCount > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={disabled}
              onClick={onBulkClearPackaging}
              title="Usuń opakowanie — zamawianie na sztuki 1:1"
            >
              Usuń opak.
              {packagingClearEligibleCount > 0
                ? ` (${packagingClearEligibleCount})`
                : ""}
            </Button>
          ) : null}
          {restoreEligibleCount > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={disabled}
              onClick={onBulkRestore}
              title="Przywróć zaznaczone wykluczone na listę do zamówienia"
            >
              Przywróć ({restoreEligibleCount})
            </Button>
          ) : null}
          {excludeEligibleCount > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="danger"
              disabled={disabled}
              onClick={onBulkExclude}
              title="Wyklucz zaznaczone z kolejnych szacunków"
            >
              Wyklucz ({excludeEligibleCount})
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
