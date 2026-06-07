"use client";

import type { IndividualOrder } from "@/types/database";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SectionListLabel } from "@/components/ui/SectionListLabel";
import { IconChevronLeft, IconChevronRight, IconClipboardList } from "@/components/icons/StrokeIcons";
import { VerificationPathBadge } from "@/components/verification/VerificationInformacjaPathPanel";
import { MyOrderAssignedClient } from "@/components/moje/MyOrderAssignedClient";
import { normalizeSalesClientName } from "@/lib/orders/sales-client-label";
import type { VerificationInformacjaUi } from "@/lib/orders/verification-informacja-ui";
import { formatPlDate } from "@/lib/display-labels";
import { cn } from "@/lib/cn";

export type VerificationQueueItemMeta = {
  id: string;
  order: IndividualOrder;
  supplierLabel: string;
  missing: string[];
  ready: boolean;
  pathUi: VerificationInformacjaUi | null;
};

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
  const prevId = activeIndex > 0 ? items[activeIndex - 1]?.id : null;
  const nextId =
    activeIndex >= 0 && activeIndex < items.length - 1
      ? items[activeIndex + 1]?.id
      : null;

  const nav =
    items.length > 1 ? (
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 px-0"
          disabled={!prevId}
          aria-label="Poprzednia prośba w kolejce"
          onClick={() => prevId && onSelect(prevId)}
        >
          <IconChevronLeft size={16} />
        </Button>
        <span className="min-w-[3.25rem] text-center text-xs tabular-nums text-slate-500">
          {activeIndex >= 0 ? activeIndex + 1 : "—"}/{items.length}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 px-0"
          disabled={!nextId}
          aria-label="Następna prośba w kolejce"
          onClick={() => nextId && onSelect(nextId)}
        >
          <IconChevronRight size={16} />
        </Button>
      </div>
    ) : null;

  if (layout === "modal") {
    return (
      <div className="flex min-h-0 shrink-0 flex-col border-b border-slate-100 lg:min-h-0 lg:shrink lg:border-b-0 lg:border-r lg:border-slate-100">
        <div className="relative border-b border-slate-100 bg-white">
          <div className={nav ? "pr-[7.5rem] sm:pr-[8rem]" : undefined}>
            <SectionListLabel
              domain="panel"
              title="Kolejka"
              hint="Wybierz prośbę z listy"
              count={items.length}
              icon={<IconClipboardList size={17} />}
              tileClassName="bg-amber-100 text-amber-800"
            />
          </div>
          {nav ? (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 sm:right-3">{nav}</div>
          ) : null}
        </div>
        <ul className="max-h-[11rem] divide-y divide-amber-100 overflow-y-auto overscroll-contain sm:max-h-[13rem] lg:max-h-none lg:min-h-0 lg:flex-1">
          {items.map((item) => (
            <VerificationQueueRow
              key={item.id}
              item={item}
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
    <div className="border-b border-slate-100 bg-gradient-to-b from-amber-50/40 to-white">
      <div className="flex items-start justify-between gap-2 px-3 py-2 sm:px-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900/90">
            Kolejka do weryfikacji
          </p>
          <p className="mt-0.5 text-xs text-slate-600">
            {items.length}{" "}
            {items.length === 1 ? "prośba wymaga uzupełnienia" : "prośby wymagają uzupełnienia"}
          </p>
        </div>
        {nav}
      </div>
      <ul
        className={cn(
          "divide-y divide-amber-100/90 overflow-y-auto overscroll-contain",
          items.length > 4 ? "max-h-[14.5rem]" : ""
        )}
        role="listbox"
        aria-label="Kolejka weryfikacji"
      >
        {items.map((item) => (
          <VerificationQueueRow
            key={item.id}
            item={item}
            active={item.id === activeId}
            onSelect={() => onSelect(item.id)}
            density="compact"
          />
        ))}
      </ul>
    </div>
  );
}

function VerificationQueueRow({
  item,
  active,
  onSelect,
  density,
}: {
  item: VerificationQueueItemMeta;
  active: boolean;
  onSelect: () => void;
  density: "compact" | "comfortable";
}) {
  const { order, supplierLabel, missing, ready, pathUi } = item;
  const clientName = normalizeSalesClientName(order.sales_client_name);

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
          "w-full text-left transition hover:bg-amber-50/80",
          active ? "bg-amber-50 ring-1 ring-inset ring-amber-200/80" : "",
          pathUi?.path === "stock_out" ? "border-l-[3px] border-l-amber-400" : "border-l-[3px] border-l-transparent",
          density === "compact" ? "px-3 py-2.5 sm:px-4" : "px-4 py-3"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p
                className={cn(
                  "font-medium text-slate-900",
                  density === "compact" ? "text-sm" : "text-sm"
                )}
              >
                {order.sales_person?.name ?? "Handlowiec"}
              </p>
              {pathUi ? <VerificationPathBadge ui={pathUi} className="text-[10px]" /> : null}
              {ready ? (
                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                  Gotowe
                </span>
              ) : missing.length ? (
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                  Brakuje {missing.length}
                </span>
              ) : null}
            </div>
            <p className="truncate text-xs text-slate-600">
              {supplierLabel} · {order.products}
            </p>
            {density === "compact" && active && missing.length ? (
              <p className="mt-0.5 text-[11px] font-medium text-amber-800">
                Brakuje: {missing.join(", ")}
              </p>
            ) : null}
            {density === "comfortable" && clientName ? (
              <MyOrderAssignedClient name={clientName} className="mt-1" />
            ) : null}
            <p className="mt-0.5 text-[11px] text-slate-500">
              {formatPlDate(order.action_at.slice(0, 10))}
              {pathUi ? ` · ${pathUi.queueHint}` : ""}
              {order.subiekt_tw_id ? " · Subiekt" : ""}
            </p>
            {density === "comfortable" && missing.length ? (
              <p className="mt-1 text-[0.68rem] font-medium text-amber-800">
                Brakuje: {missing.join(", ")}
              </p>
            ) : null}
            {density === "comfortable" && ready ? (
              <p className="mt-1 text-[0.68rem] font-medium text-emerald-700">
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
