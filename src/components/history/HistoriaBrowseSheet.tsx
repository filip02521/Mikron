"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { IndividualOrder } from "@/types/database";
import {
  matchesIndividualSearch,
  matchesNormalSearch,
} from "@/lib/orders/history-search";
import { HISTORY_RETENTION_MONTHS } from "@/lib/orders/history-retention";
import { HistoriaIndividualTable } from "@/components/history/HistoriaIndividualTable";
import {
  HistoriaNormalTable,
  type NormalHistoryRow,
} from "@/components/history/HistoriaNormalTable";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";
import { IconX } from "@/components/icons/StrokeIcons";
import { FOCUSABLE_SELECTOR } from "@/components/ui/ModalShell";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { useClientHydrated } from "@/lib/client/use-client-hydrated";
import { cn } from "@/lib/cn";
import { sidePanelBackdropClass, sidePanelHeaderClass, sideSheetWidePanelClass } from "@/lib/ui/surfaces";
import { controlFocusClass } from "@/lib/ui/ontime-theme";
import { SCROLL_LOCK_ALLOW_ATTR, useBodyScrollLock } from "@/lib/ui/page-scroll-lock";
import { useAnimatedClose } from "@/lib/ui/use-animated-close";

export function HistoriaBrowseSheet({
  open,
  kind,
  individual,
  normal,
  canOperateOrders,
  canManageHistory,
  pending,
  initialQuery = "",
  supplierId = null,
  onClose,
  onRemoveIndividual,
  onRemoveNormal,
  onCancelIndividual,
  onEditNoteIndividual,
}: {
  open: boolean;
  kind: "individual" | "normal";
  individual: IndividualOrder[];
  normal: NormalHistoryRow[];
  canOperateOrders: boolean;
  canManageHistory: boolean;
  pending: boolean;
  /** Prefill wyszukiwania (np. nazwa z deep-linku). */
  initialQuery?: string;
  /** Precyzyjny filtr po dostawcy (deep-link z panelu). */
  supplierId?: string | null;
  onClose: () => void;
  onRemoveIndividual: (id: string) => void;
  onRemoveNormal: (id: string) => void;
  onCancelIndividual?: (order: IndividualOrder) => void;
  onEditNoteIndividual?: (order: IndividualOrder) => void;
}) {
  const hydrated = useClientHydrated();
  const [query, setQuery] = useState(initialQuery);
  const supplierKey = supplierId?.toLowerCase() ?? null;

  const handleClose = useCallback(() => {
    setQuery("");
    onClose();
  }, [onClose]);
  const { panelRef, backdropRef, requestClose } = useAnimatedClose(handleClose);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      const panel = panelRef.current;
      if (event.key === "Escape") {
        // Escape w oknie nad panelem (anulowanie, notatka, „Usunąć wpis?”) zamyka tylko to okno.
        const target = event.target instanceof Element ? event.target : null;
        const fromDialog = target?.closest('[role="dialog"], [role="alertdialog"]');
        if (fromDialog && panel && !panel.contains(fromDialog)) return;
        if (document.querySelector('[role="alertdialog"]')) return;
        requestClose();
        return;
      }
      // Pułapka Tab — panel jest modalny (aria-modal), fokus zostaje w środku.
      if (event.key !== "Tab" || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
        (el) => el.offsetParent !== null
      );
      if (!items.length) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, requestClose, panelRef]);

  // Przycisk otwierający czytany przy renderze — zanim autoFocus przeniesie fokus do pola szukania.
  const [opener] = useState(() =>
    typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null)
  );
  // Po zamknięciu fokus wraca na przycisk, który otworzył panel.
  useEffect(() => {
    if (!open) return;
    return () => opener?.focus?.();
  }, [open, opener]);

  useBodyScrollLock(open);

  const filteredIndividual = useMemo(
    () =>
      individual.filter((o) => {
        if (supplierKey && (o.supplier_id ?? "").toLowerCase() !== supplierKey) {
          return false;
        }
        return matchesIndividualSearch(o, query);
      }),
    [individual, query, supplierKey]
  );
  const filteredNormal = useMemo(
    () =>
      normal.filter((h) => {
        if (supplierKey && (h.supplier_id ?? "").toLowerCase() !== supplierKey) {
          return false;
        }
        return matchesNormalSearch(h, query);
      }),
    [normal, query, supplierKey]
  );

  if (!open || !hydrated) return null;

  const isIndividual = kind === "individual";
  const total = isIndividual ? individual.length : normal.length;
  const shown = isIndividual ? filteredIndividual.length : filteredNormal.length;
  const hasActiveFilter = Boolean(query.trim() || supplierKey);
  const title = isIndividual ? "Prośby indywidualne" : "Zamówienia standardowe";
  const searchPlaceholder = isIndividual
    ? "Nazwa produktu, symbol, dostawca, handlowiec…"
    : "Użytkownik, dostawca, akcja…";
  const retentionLabel = `${HISTORY_RETENTION_MONTHS} miesięcy`;
  const emptyFilterDescription =
    supplierKey && !query.trim()
      ? "Brak wpisów dla tego dostawcy w ostatnim okresie."
      : `Nie znaleziono pasujących do „${query.trim()}”.`;

  return createPortal(
    <>
      <button
        ref={(el) => {
          backdropRef.current = el;
        }}
        type="button"
        tabIndex={-1}
        className={cn(sidePanelBackdropClass, "z-[58] panel-slide-backdrop-enter")}
        aria-label="Zamknij historię"
        onClick={requestClose}
      />
      <aside
        ref={(el) => {
          panelRef.current = el;
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="historia-sheet-title"
        className={cn(
          "panel-slide-enter fixed inset-y-0 right-0 z-[60]",
          sideSheetWidePanelClass
        )}
      >
        <header className={cn(sidePanelHeaderClass, "px-4 sm:px-5")}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="historia-sheet-title" className="text-lg font-semibold text-slate-900">
                {title}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {hasActiveFilter
                  ? `${shown} z ${total} ${polishPluralWord(total, "wpisu", "wpisów", "wpisów")} (ostatnie ${retentionLabel})`
                  : `${total} ${polishPluralWord(total, "wpis", "wpisy", "wpisów")} z ostatnich ${retentionLabel}`}
                {supplierKey ? (
                  <span className="mt-0.5 block text-slate-700">Filtr: wybrany dostawca (z panelu)</span>
                ) : null}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className={cn(controlFocusClass, "size-11 shrink-0 p-0 sm:size-8")}
              onClick={requestClose}
              aria-label="Zamknij"
            >
              <IconX size={18} />
            </Button>
          </div>
          <label className="mt-3 block">
            <span className="sr-only">Szukaj w historii</span>
            <Input
              type="search"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              autoFocus
            />
          </label>
        </header>

        <div
          className="min-h-0 flex-1 overflow-y-auto"
          {...{ [SCROLL_LOCK_ALLOW_ATTR]: "" }}
        >
          {isIndividual ? (
            !individual.length ? (
              <div className="px-4 py-8 sm:px-5">
                <EmptyState title="Brak wpisów" />
              </div>
            ) : !filteredIndividual.length ? (
              <div className="px-4 py-8 sm:px-5">
                <EmptyState
                  title="Brak wyników"
                  description={emptyFilterDescription}
                />
              </div>
            ) : (
              <HistoriaIndividualTable
                rows={filteredIndividual}
                canOperateOrders={canOperateOrders}
                canManageHistory={canManageHistory}
                pending={pending}
                onCancel={onCancelIndividual}
                onEditNote={onEditNoteIndividual}
                onRemove={onRemoveIndividual}
              />
            )
          ) : !normal.length ? (
            <div className="px-4 py-8 sm:px-5">
              <EmptyState title="Brak wpisów" />
            </div>
          ) : !filteredNormal.length ? (
            <div className="px-4 py-8 sm:px-5">
              <EmptyState
                title="Brak wyników"
                description={emptyFilterDescription}
              />
            </div>
          ) : (
            <HistoriaNormalTable
              rows={filteredNormal}
              canManageHistory={canManageHistory}
              pending={pending}
              onRemove={onRemoveNormal}
            />
          )}
        </div>
      </aside>
    </>,
    document.body
  );
}
