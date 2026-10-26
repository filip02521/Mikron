"use client";

import type { IndividualOrder } from "@/types/database";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  IconChevronLeft,
  IconChevronRight,
} from "@/components/icons/StrokeIcons";
import { VerificationPathBadge } from "@/components/verification/VerificationInformacjaPathPanel";
import { MyOrderAssignedClient } from "@/components/moje/MyOrderAssignedClient";
import { normalizeSalesClientName } from "@/lib/orders/sales-client-label";
import { normalizeSalesRequestNote } from "@/lib/orders/sales-request-note";
import type { VerificationInformacjaUi } from "@/lib/orders/verification-informacja-ui";
import { formatPlDate } from "@/lib/display-labels";
import { cn } from "@/lib/cn";
import { panelTypography, salesRequestNoteLabelClass, sectionTitleClass } from "@/lib/ui/ontime-theme";

export type VerificationQueueItemMeta = {
  id: string;
  order: IndividualOrder;
  supplierLabel: string;
  missing: string[];
  ready: boolean;
  pathUi: VerificationInformacjaUi | null;
};

function QueueNav({
  items,
  activeIndex,
  onSelect,
}: {
  items: VerificationQueueItemMeta[];
  activeIndex: number;
  onSelect: (id: string) => void;
}) {
  if (items.length <= 1) return null;

  const prevId = activeIndex > 0 ? items[activeIndex - 1]?.id : null;
  const nextId =
    activeIndex >= 0 && activeIndex < items.length - 1
      ? items[activeIndex + 1]?.id
      : null;

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="size-11 px-0 sm:size-8"
        disabled={!prevId}
        aria-label="Poprzednia prośba w kolejce"
        onClick={() => prevId && onSelect(prevId)}
      >
        <IconChevronLeft size={16} />
      </Button>
      <span className="min-w-[3.25rem] text-center text-xs font-medium tabular-nums text-slate-600">
        {activeIndex >= 0 ? activeIndex + 1 : "-"}/{items.length}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="size-11 px-0 sm:size-8"
        disabled={!nextId}
        aria-label="Następna prośba w kolejce"
        onClick={() => nextId && onSelect(nextId)}
      >
        <IconChevronRight size={16} />
      </Button>
    </div>
  );
}

export function VerificationQueuePicker({
  items,
  activeId,
  onSelect,
  layout,
}: {
  items: VerificationQueueItemMeta[];
  activeId: string | null;
  onSelect: (id: string) => void;
  layout: "page" | "modal";
}) {
  const activeIndex = items.findIndex((item) => item.id === activeId);
  const scrollable = items.length >= 2;
  const listMaxHeight =
    layout === "page"
      ? scrollable
        ? "max-h-[min(16rem,42vh)]"
        : ""
      : scrollable
        ? "max-h-[11rem] sm:max-h-[13rem] lg:max-h-none"
        : "";

  const headerNav = (
    <QueueNav items={items} activeIndex={activeIndex} onSelect={onSelect} />
  );

  if (layout === "modal") {
    return (
      <div className="flex min-h-0 shrink-0 flex-col lg:min-h-0 lg:shrink lg:border-r lg:border-slate-200">
        <QueueHeader
          title="Kolejka"
          description="Wybierz prośbę, uzupełnisz ją obok."
          count={items.length}
          nav={items.length > 1 ? headerNav : null}
        />
        <ul
          className={cn(
            "divide-y divide-slate-100 overflow-y-auto overscroll-contain bg-white",
            listMaxHeight,
            "lg:min-h-0 lg:flex-1"
          )}
          role="listbox"
          aria-label="Kolejka weryfikacji"
        >
          {items.map((item, index) => (
            <VerificationQueueRow
              key={item.id}
              item={item}
              index={index}
              showIndex={items.length > 1}
              active={item.id === activeId}
              onSelect={() => onSelect(item.id)}
              density="comfortable"
            />
          ))}
        </ul>
      </div>
    );
  }

  return (
    <section aria-label="Kolejka do weryfikacji" className="border-b border-slate-100">
      <QueueHeader
        title="Kolejka do weryfikacji"
        description={
          items.length === 1
            ? "Jedna prośba. Uzupełnij formularz poniżej."
            : "Wybierz prośbę, formularz jest pod kolejką."
        }
        count={items.length}
        nav={items.length > 1 ? headerNav : null}
      />

      <ul
        className={cn(
          "relative divide-y divide-slate-100 overflow-y-auto overscroll-contain bg-white",
          listMaxHeight,
          scrollable &&
            "after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-6 after:bg-gradient-to-t after:from-white after:to-transparent"
        )}
        role="listbox"
        aria-label="Kolejka weryfikacji"
      >
        {items.map((item, index) => (
          <VerificationQueueRow
            key={item.id}
            item={item}
            index={index}
            showIndex={items.length > 1}
            active={item.id === activeId}
            onSelect={() => onSelect(item.id)}
            density="compact"
          />
        ))}
      </ul>

    </section>
  );
}

function QueueHeader({
  title,
  description,
  count,
  nav,
}: {
  title: string;
  description: string;
  count: number;
  nav: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-3 py-3 sm:px-4">
      <div className="min-w-0">
        <h2 className={cn("flex items-baseline gap-1.5", sectionTitleClass)}>
          {title}
          <span className={cn("font-normal tabular-nums", panelTypography.rowMeta)}>{count}</span>
        </h2>
        <p className={cn("mt-0.5", panelTypography.rowMeta)}>{description}</p>
      </div>
      {nav ? <div className="shrink-0">{nav}</div> : null}
    </div>
  );
}

function VerificationQueueRow({
  item,
  index,
  showIndex,
  active,
  onSelect,
  density,
}: {
  item: VerificationQueueItemMeta;
  index: number;
  showIndex: boolean;
  active: boolean;
  onSelect: () => void;
  density: "compact" | "comfortable";
}) {
  const { order, supplierLabel, missing, ready, pathUi } = item;
  const clientName = normalizeSalesClientName(order.sales_client_name);
  const requestNote = normalizeSalesRequestNote(order.sales_request_note);

  return (
    <li role="presentation">
      <button
        type="button"
        role="option"
        aria-selected={active}
        title={
          missing.length && !ready
            ? `Brakuje: ${missing.join(", ")}`
            : ready
              ? "Gotowe do zatwierdzenia"
              : undefined
        }
        onClick={onSelect}
        className={cn(
          "group relative w-full text-left transition-colors duration-150",
          density === "compact" ? "px-3 py-3 sm:px-4" : "px-4 py-3.5",
          active ? "bg-indigo-50" : "bg-white hover:bg-slate-50"
        )}
      >
        <div className="flex items-start gap-2.5">
          <span
            className={cn(
              "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
              active
                ? "border-indigo-600 bg-indigo-600"
                : "border-slate-300 bg-white group-hover:border-slate-400"
            )}
            aria-hidden
          >
            {active ? (
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            ) : null}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {showIndex ? (
                <span className="text-[0.6875rem] font-semibold tabular-nums text-slate-500">
                  {index + 1}.
                </span>
              ) : null}
              <p className={panelTypography.rowTitle}>
                {order.sales_person?.name ?? "Handlowiec"}
              </p>
              {pathUi ? <VerificationPathBadge ui={pathUi} className="text-[0.625rem]" /> : null}
              {ready ? (
                <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[0.625rem] font-semibold text-emerald-800">
                  Gotowe
                </span>
              ) : missing.length ? (
                <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[0.625rem] font-semibold text-amber-900">
                  Brakuje {missing.length}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-600">
              <span className="font-medium text-slate-700">{supplierLabel}</span>
              <span className="text-slate-400"> · </span>
              {order.products}
            </p>
            {density === "compact" && active && missing.length ? (
              <p className="mt-1 text-[0.6875rem] font-medium text-amber-900">
                Brakuje: {missing.join(", ")}
              </p>
            ) : null}
            {density === "comfortable" && clientName ? (
              <MyOrderAssignedClient name={clientName} className="mt-1" />
            ) : null}
            {requestNote ? (
              <p className="mt-1 line-clamp-3 text-[0.6875rem] leading-snug text-slate-500">
                <span className={salesRequestNoteLabelClass}>Uwagi</span>{" "}
                <span className="font-medium text-slate-800">{requestNote}</span>
              </p>
            ) : null}
            <p className="mt-1 text-[0.6875rem] text-slate-500">
              {formatPlDate(order.action_at.slice(0, 10))}
              {pathUi ? ` · ${pathUi.queueHint}` : ""}
              {order.subiekt_tw_id ? " · Subiekt" : ""}
            </p>
            {density === "comfortable" && missing.length ? (
              <p className="mt-1 text-[0.6875rem] font-medium text-amber-900">
                Brakuje: {missing.join(", ")}
              </p>
            ) : null}
            {density === "comfortable" && ready ? (
              <p className="mt-1 text-[0.6875rem] font-medium text-emerald-700">
                Gotowe do zatwierdzenia
              </p>
            ) : null}
          </div>
          {!ready && density === "comfortable" ? (
            <Badge variant="warning" className="shrink-0">
              Weryfikacja
            </Badge>
          ) : null}
        </div>
      </button>
    </li>
  );
}
