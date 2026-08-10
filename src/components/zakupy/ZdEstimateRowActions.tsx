"use client";

import {
  OverflowMenu,
  OverflowMenuItem,
  OverflowMenuLabel,
  OverflowMenuSeparator,
} from "@/components/ui/OverflowMenu";

/**
 * Akcje wiersza listy szacunku — menu zamiast dwóch przycisków,
 * żeby kolumna nie rozpychała tabeli. „Wyklucz” jest danger.
 */
export function ZdEstimateRowActions({
  symbol,
  /** Auto z nazwy (outlet / wycofane) — bez „Przywróć” z bazy. */
  nameAutoExcluded = false,
  /** Trwałe wykluczenie w bazie — można przywrócić. */
  dbExcluded = false,
  packagingHint,
  disabled,
  pending,
  onPackaging,
  onExclude,
  onRestore,
}: {
  symbol: string;
  nameAutoExcluded?: boolean;
  dbExcluded?: boolean;
  /** np. „10 szt / 1 op.” albo null gdy 1:1 */
  packagingHint: string | null;
  disabled?: boolean;
  pending?: boolean;
  onPackaging: () => void;
  onExclude: () => void;
  onRestore: () => void;
}) {
  const showRestore = dbExcluded;
  const showExclude = !dbExcluded && !nameAutoExcluded;

  return (
    <OverflowMenu
      label={`Akcje: ${symbol}`}
      align="end"
      iconOnly
      disabled={disabled || pending}
      triggerClassName="h-8 w-8 border-slate-200/90 bg-white shadow-sm shadow-slate-900/[0.03] hover:border-slate-300 hover:bg-slate-50"
      menuClassName="min-w-[15.5rem]"
    >
      <OverflowMenuLabel>{symbol}</OverflowMenuLabel>
      <OverflowMenuItem disabled={disabled || pending} onClick={onPackaging}>
        <span className="block font-medium leading-snug">
          {packagingHint ? "Opakowanie" : "Ustaw opakowanie"}
        </span>
        <span className="mt-0.5 block text-[11px] font-normal leading-snug text-slate-400">
          {packagingHint
            ? packagingHint
            : "1 na ZD = N sztuk (np. Falcon 10)"}
        </span>
      </OverflowMenuItem>
      {nameAutoExcluded ? (
        <>
          <OverflowMenuSeparator />
          <OverflowMenuItem disabled onClick={() => {}}>
            <span className="block font-medium leading-snug text-slate-500">
              Auto-wykluczenie
            </span>
            <span className="mt-0.5 block text-[11px] font-normal leading-snug text-slate-400">
              Outlet / wycofane w nazwie albo katalog zębów
            </span>
          </OverflowMenuItem>
        </>
      ) : null}
      {showRestore || showExclude ? <OverflowMenuSeparator /> : null}
      {showRestore ? (
        <OverflowMenuItem disabled={disabled || pending} onClick={onRestore}>
          <span className="block font-medium leading-snug">
            {pending ? "Przywracam…" : "Przywróć"}
          </span>
          <span className="mt-0.5 block text-[11px] font-normal leading-snug text-slate-400">
            {nameAutoExcluded
              ? "Usuń z listy trwałej (auto z nazwy zostaje)"
              : "Znowu na liście do zamówienia"}
          </span>
        </OverflowMenuItem>
      ) : null}
      {showExclude ? (
        <OverflowMenuItem danger disabled={disabled || pending} onClick={onExclude}>
          <span className="block font-medium leading-snug">Wyklucz</span>
          <span className="mt-0.5 block text-[11px] font-normal leading-snug text-red-600/75">
            Ukryj przy kolejnych szacunkach
          </span>
        </OverflowMenuItem>
      ) : null}
    </OverflowMenu>
  );
}
