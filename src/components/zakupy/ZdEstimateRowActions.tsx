"use client";

import {
  OverflowMenu,
  OverflowMenuItem,
  OverflowMenuLabel,
  OverflowMenuSeparator,
} from "@/components/ui/OverflowMenu";

/**
 * Akcje wiersza listy kreatora — menu zamiast dwóch przycisków,
 * żeby kolumna nie rozpychała tabeli. „Wyklucz” jest danger.
 */
export function ZdEstimateRowActions({
  symbol,
  /** Auto z nazwy (outlet / wycofane) — bez „Przywróć” z bazy. */
  nameAutoExcluded = false,
  /** Trwałe wykluczenie w bazie — można przywrócić. */
  dbExcluded = false,
  /** Session override: dołącz mimo auto-wykluczenia. */
  sessionIncluded = false,
  /** Trwałe „tylko na prośbę”. */
  onRequest = false,
  /**
   * Piece pary / BOM assembled — bez Wyklucz / Na prośbę (nie idą na ZD;
   * flaga żyje na packu).
   */
  hideHardExclude = false,
  /** kit_only composition — bez „Na prośbę” (nie obchodzić purchaseBlocked). */
  hideOnRequest = false,
  packagingHint,
  disabled,
  pending,
  onPackaging,
  onExclude,
  onRestore,
  onSessionInclude,
  onSessionIncludeClear,
  onMarkOnRequest,
  onClearOnRequest,
}: {
  symbol: string;
  nameAutoExcluded?: boolean;
  dbExcluded?: boolean;
  sessionIncluded?: boolean;
  onRequest?: boolean;
  hideHardExclude?: boolean;
  hideOnRequest?: boolean;
  /** np. „10 szt / 1 op.” albo null gdy 1:1 */
  packagingHint: string | null;
  disabled?: boolean;
  pending?: boolean;
  onPackaging: () => void;
  onExclude: () => void;
  onRestore: () => void;
  onSessionInclude?: () => void;
  onSessionIncludeClear?: () => void;
  onMarkOnRequest?: () => void;
  onClearOnRequest?: () => void;
}) {
  const showRestore = dbExcluded;
  const showExclude =
    !dbExcluded && !nameAutoExcluded && !hideHardExclude;
  const showSessionInclude =
    nameAutoExcluded &&
    !sessionIncluded &&
    !onRequest &&
    Boolean(onSessionInclude);
  const showSessionIncludeClear =
    nameAutoExcluded &&
    sessionIncluded &&
    !onRequest &&
    Boolean(onSessionIncludeClear);
  const showMarkOnRequest =
    !dbExcluded &&
    !onRequest &&
    !nameAutoExcluded &&
    !hideHardExclude &&
    !hideOnRequest &&
    Boolean(onMarkOnRequest);
  // Clear dozwolony także przy purchaseBlocked — qty i tak blokuje bomBlocksZdOrder;
  // pozwala posprzątać legacy „na prośbę” po zmianie presetu na kit_only.
  const showClearOnRequest = onRequest && Boolean(onClearOnRequest);

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
          {showSessionInclude ? (
            <OverflowMenuItem
              disabled={disabled || pending}
              onClick={() => onSessionInclude?.()}
            >
              <span className="block font-medium leading-snug">
                Dołącz mimo auto
              </span>
              <span className="mt-0.5 block text-[11px] font-normal leading-snug text-slate-400">
                Tylko ta sesja / lista — znika po Policz
              </span>
            </OverflowMenuItem>
          ) : null}
          {showSessionIncludeClear ? (
            <OverflowMenuItem
              disabled={disabled || pending}
              onClick={() => onSessionIncludeClear?.()}
            >
              <span className="block font-medium leading-snug">
                Cofnij dołączenie
              </span>
              <span className="mt-0.5 block text-[11px] font-normal leading-snug text-slate-400">
                Wróć do auto-wykluczenia
              </span>
            </OverflowMenuItem>
          ) : null}
          {!showSessionInclude && !showSessionIncludeClear ? (
            <OverflowMenuItem disabled onClick={() => {}}>
              <span className="block font-medium leading-snug text-slate-500">
                Auto-wykluczenie
              </span>
              <span className="mt-0.5 block text-[11px] font-normal leading-snug text-slate-400">
                Outlet / wycofane w nazwie albo katalog zębów
              </span>
            </OverflowMenuItem>
          ) : null}
        </>
      ) : null}
      {showMarkOnRequest || showClearOnRequest ? (
        <OverflowMenuSeparator />
      ) : null}
      {showMarkOnRequest ? (
        <OverflowMenuItem
          disabled={disabled || pending}
          onClick={() => onMarkOnRequest?.()}
        >
          <span className="block font-medium leading-snug">Tylko na prośbę</span>
          <span className="mt-0.5 block text-[11px] font-normal leading-snug text-slate-400">
            Poza Do ZD, aż handlowiec złoży prośbę (qty = prośba)
          </span>
        </OverflowMenuItem>
      ) : null}
      {showClearOnRequest ? (
        <OverflowMenuItem
          disabled={disabled || pending}
          onClick={() => onClearOnRequest?.()}
        >
          <span className="block font-medium leading-snug">
            Usuń „tylko na prośbę”
          </span>
          <span className="mt-0.5 block text-[11px] font-normal leading-snug text-slate-400">
            Wraca zwykłe liczenie zapasu
          </span>
        </OverflowMenuItem>
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
