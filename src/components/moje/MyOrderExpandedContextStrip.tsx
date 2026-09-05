"use client";

import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import type { MyOrderMetaField } from "@/lib/orders/my-order-sales-ui";
import { MyOrderAssignedClient } from "@/components/moje/MyOrderAssignedClient";
import { MyOrderProcurementCancelNote } from "@/components/moje/MyOrderProcurementCancelNote";
import { MyOrderRequestNote } from "@/components/moje/MyOrderRequestNote";
import { MyOrderStatusPill } from "@/components/moje/MyOrderStatusPill";
import { SearchHighlightText } from "@/components/moje/SearchHighlightText";
import { cn } from "@/lib/cn";

export type MyOrderExpandedContextStripProps = {
  row: MyOrderRow;
  searchQuery?: string | null;
  metaFields: MyOrderMetaField[];
  showStatusBadge: boolean;
  expandedNotes?: string | null;
  sharedRequestNote?: string | null;
  sharedProcurementCancelNote?: string | null;
  showSharedUnreadRequestNote?: boolean;
  clientLabel?: string | null;
  /** kh_Id Subiekta — gdy wspólny klient grupy (kopiowanie NIP). */
  clientKhId?: number | null;
  progressLabel?: string | null;
};

/**
 * Kontekst grupy nad listą produktów: klient, status, uwagi.
 * Termin dostawy jest w osobnym panelu nad produktami ({@link MyOrderExpandedDeliveryPanel}).
 */
export function MyOrderExpandedContextStrip({
  row,
  searchQuery,
  metaFields,
  showStatusBadge,
  expandedNotes,
  sharedRequestNote,
  sharedProcurementCancelNote,
  showSharedUnreadRequestNote,
  clientLabel,
  clientKhId,
  progressLabel,
}: MyOrderExpandedContextStripProps) {
  const hasNotesPanel =
    sharedProcurementCancelNote || (sharedRequestNote && !showSharedUnreadRequestNote);

  const hasContent =
    clientLabel ||
    progressLabel ||
    metaFields.length > 0 ||
    showStatusBadge ||
    expandedNotes ||
    hasNotesPanel;

  if (!hasContent) return null;

  return (
    <div className="space-y-2 border-b border-slate-100 px-0 pb-2 pt-1">
      {(clientLabel || progressLabel || metaFields.length > 0 || showStatusBadge) ? (
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-[10px] leading-tight">
          {showStatusBadge ? (
            <MyOrderStatusPill
              label={row.statusTitle}
              variant={row.badgeVariant}
              searchQuery={searchQuery}
              className="text-xs"
            />
          ) : null}
          {clientLabel ? (
            <MyOrderAssignedClient
              name={clientLabel}
              clientKhId={clientKhId}
              searchQuery={searchQuery}
              className="text-[10px] leading-tight"
            />
          ) : null}
          {progressLabel ? (
            <span className="inline-flex items-baseline gap-0.5">
              <span className="font-medium text-indigo-400">Magazyn</span>
              <SearchHighlightText
                text={progressLabel}
                searchQuery={searchQuery}
                className="font-semibold text-amber-700"
              />
            </span>
          ) : null}
          {metaFields.map((f, i) => (
            <span key={f.label} className="inline-flex items-baseline gap-0.5">
              {(i > 0 || clientLabel || progressLabel || showStatusBadge) ? (
                <span className="text-slate-300">·</span>
              ) : null}
              <span className="font-medium text-indigo-400">{f.label}</span>
              <SearchHighlightText
                text={f.value}
                searchQuery={searchQuery}
                className={cn("text-slate-600", f.emphasize && "font-semibold text-amber-700")}
              />
            </span>
          ))}
        </div>
      ) : null}

      {expandedNotes ? (
        <span className="inline-flex items-start gap-1 rounded bg-sky-50 px-1.5 py-1 text-[10px] leading-snug text-sky-700">
          <svg viewBox="0 0 16 16" className="mt-0.5 size-3 shrink-0" fill="currentColor" aria-hidden>
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 3a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75Z" />
          </svg>
          <SearchHighlightText text={expandedNotes} searchQuery={searchQuery} className="text-sky-700" />
        </span>
      ) : null}

      {hasNotesPanel ? (
        <div className="space-y-1.5">
          {sharedRequestNote && !showSharedUnreadRequestNote ? (
            <MyOrderRequestNote note={sharedRequestNote} searchQuery={searchQuery} />
          ) : null}
          {sharedProcurementCancelNote ? (
            <MyOrderProcurementCancelNote note={sharedProcurementCancelNote} searchQuery={searchQuery} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
