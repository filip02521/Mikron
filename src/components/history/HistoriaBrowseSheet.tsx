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
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { IconArchive, IconClipboardList } from "@/components/icons/StrokeIcons";
import { navIconTileClassForTone } from "@/components/icons/NavIcon";
import { useClientHydrated } from "@/lib/client/use-client-hydrated";
import { cn } from "@/lib/cn";
import { sideSheetWidePanelClass } from "@/lib/ui/surfaces";
import { controlFocusClass, panelTypography } from "@/lib/ui/ontime-theme";

export function HistoriaBrowseSheet({
  open,
  kind,
  individual,
  normal,
  canOperateOrders,
  canManageHistory,
  pending,
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
  onClose: () => void;
  onRemoveIndividual: (id: string) => void;
  onRemoveNormal: (id: string) => void;
  onCancelIndividual?: (order: IndividualOrder) => void;
  onEditNoteIndividual?: (order: IndividualOrder) => void;
}) {
  const hydrated = useClientHydrated();
  const [query, setQuery] = useState("");

  const handleClose = useCallback(() => {
    setQuery("");
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const filteredIndividual = useMemo(
    () => individual.filter((o) => matchesIndividualSearch(o, query)),
    [individual, query]
  );
  const filteredNormal = useMemo(
    () => normal.filter((h) => matchesNormalSearch(h, query)),
    [normal, query]
  );

  if (!open || !hydrated) return null;

  const isIndividual = kind === "individual";
  const total = isIndividual ? individual.length : normal.length;
  const shown = isIndividual ? filteredIndividual.length : filteredNormal.length;
  const title = isIndividual ? "Historia indywidualna" : "Zamówienia standardowe";
  const searchPlaceholder = isIndividual
    ? "Nazwa produktu, symbol, dostawca, handlowiec…"
    : "Użytkownik, dostawca, akcja…";
  const retentionLabel = `${HISTORY_RETENTION_MONTHS} miesięcy`;

  return createPortal(
    <div
      className="fixed inset-0 z-[60]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="historia-sheet-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px]"
        aria-label="Zamknij historię"
        onClick={handleClose}
      />
      <aside
        className={cn(
          "absolute inset-y-0 right-0",
          sideSheetWidePanelClass
        )}
      >
        <header className="shrink-0 border-b border-indigo-100/70 bg-indigo-50/20 px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <SectionHeadingIcon
                tileClassName={
                  isIndividual
                    ? navIconTileClassForTone("indigo")
                    : navIconTileClassForTone("slate")
                }
              >
                {isIndividual ? (
                  <IconClipboardList size={18} />
                ) : (
                  <IconArchive size={18} />
                )}
              </SectionHeadingIcon>
              <div className="min-w-0">
                <h2 id="historia-sheet-title" className={panelTypography.rowTitle}>
                  {title}
                </h2>
                <p className={cn(panelTypography.caption, "mt-0.5")}>
                  {query.trim()
                    ? `${shown} z ${total} wpisów (ostatnie ${retentionLabel})`
                    : `${total} wpisów z ostatnich ${retentionLabel}`}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className={controlFocusClass} onClick={handleClose}>
              Zamknij
            </Button>
          </div>
          <label className="mt-3 block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">Szukaj</span>
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

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isIndividual ? (
            !individual.length ? (
              <div className="px-4 py-8 sm:px-5">
                <EmptyState title="Brak wpisów" />
              </div>
            ) : !filteredIndividual.length ? (
              <div className="px-4 py-8 sm:px-5">
                <EmptyState
                  title="Brak wyników"
                  description={`Nie znaleziono pasujących do „${query.trim()}”.`}
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
                description={`Nie znaleziono pasujących do „${query.trim()}”.`}
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
    </div>,
    document.body
  );
}
