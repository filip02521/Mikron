"use client";

import type { IndividualOrder } from "@/types/database";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SectionListLabel } from "@/components/ui/SectionListLabel";
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconClipboardList,
} from "@/components/icons/StrokeIcons";
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
        className="h-8 w-8 px-0"
        disabled={!prevId}
        aria-label="Poprzednia prośba w kolejce"
        onClick={() => prevId && onSelect(prevId)}
      >
        <IconChevronLeft size={16} />
      </Button>
      <span className="min-w-[3.25rem] text-center text-xs font-medium tabular-nums text-slate-600">
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
  );
}

function QueueFooter({ layout }: { layout: "page" | "modal" }) {
  const label =
    layout === "modal"
      ? "Formularz uzupełnienia obok"
      : "Formularz uzupełnienia poniżej";

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-1.5 border-t border-amber-200/90 px-3 py-2 text-[11px] font-medium text-amber-900/85",
        layout === "page" ? "bg-amber-50/70" : "bg-amber-50/50"
      )}
    >
      {layout === "page" ? (
        <IconChevronDown size={14} className="shrink-0 opacity-70" aria-hidden />
      ) : null}
      <span>{label}</span>
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
        <div className="relative overflow-hidden rounded-tl-md border-b border-amber-200/80 bg-white">
          <div className={items.length > 1 ? "pr-[7.5rem] sm:pr-[8rem]" : undefined}>
            <SectionListLabel
              domain="panel"
              title="Kolejka"
              hint="Wybierz prośbę — uzupełnisz ją obok"
              count={items.length}
              icon={<IconClipboardList size={17} />}
              tileClassName="bg-amber-100 text-amber-800"
            />
          </div>
          {items.length > 1 ? (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 sm:right-3">
              {headerNav}
            </div>
          ) : null}
        </div>
        <ul
          className={cn(
            "divide-y divide-amber-100/90 overflow-y-auto overscroll-contain bg-white",
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
        <QueueFooter layout="modal" />
      </div>
    );
  }

  return (
    <section
      aria-label="Kolejka do weryfikacji"
      className="mx-3 my-3 overflow-hidden rounded-lg border border-amber-200/90 bg-white shadow-sm ring-1 ring-amber-100/50 sm:mx-4"
    >
      <div className="relative border-b border-amber-200/80 bg-gradient-to-b from-amber-50 to-amber-50/30">
        <div className={items.length > 1 ? "pr-[7.5rem] sm:pr-[8rem]" : undefined}>
          <SectionListLabel
            domain="panel"
            title="Kolejka do weryfikacji"
            hint={
              items.length === 1
                ? "Jedna prośba — uzupełnij formularz poniżej"
                : "Kliknij wpis — formularz pod kolejką"
            }
            count={items.length}
            icon={<IconClipboardList size={17} />}
            tileClassName="bg-amber-100 text-amber-800"
          />
        </div>
        {items.length > 1 ? (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 sm:right-3">{headerNav}</div>
        ) : null}
      </div>

      <ul
        className={cn(
          "relative divide-y divide-amber-100 overflow-y-auto overscroll-contain bg-white",
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

      <QueueFooter layout="page" />
    </section>
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
          "group relative w-full border-l-[3px] text-left transition",
          density === "compact" ? "px-3 py-3 sm:px-4" : "px-4 py-3.5",
          active
            ? "border-l-amber-500 bg-amber-50/90 shadow-[inset_0_1px_0_0_rgba(251,191,36,0.15)]"
            : "border-l-transparent bg-white hover:bg-amber-50/50",
          pathUi?.path === "stock_out" && !active && "border-l-amber-300/80"
        )}
      >
        <div className="flex items-start gap-2.5">
          <span
            className={cn(
              "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
              active
                ? "border-amber-600 bg-amber-600"
                : "border-slate-300 bg-white group-hover:border-amber-300"
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
                <span className="text-[11px] font-semibold tabular-nums text-slate-400">
                  {index + 1}.
                </span>
              ) : null}
              <p className="text-sm font-semibold text-slate-900">
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
            <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-600">
              <span className="font-medium text-slate-700">{supplierLabel}</span>
              <span className="text-slate-400"> · </span>
              {order.products}
            </p>
            {density === "compact" && active && missing.length ? (
              <p className="mt-1 text-[11px] font-medium text-amber-900">
                Brakuje: {missing.join(", ")}
              </p>
            ) : null}
            {density === "comfortable" && clientName ? (
              <MyOrderAssignedClient name={clientName} className="mt-1" />
            ) : null}
            <p className="mt-1 text-[11px] text-slate-500">
              {formatPlDate(order.action_at.slice(0, 10))}
              {pathUi ? ` · ${pathUi.queueHint}` : ""}
              {order.subiekt_tw_id ? " · Subiekt" : ""}
            </p>
            {density === "comfortable" && missing.length ? (
              <p className="mt-1 text-[11px] font-medium text-amber-900">
                Brakuje: {missing.join(", ")}
              </p>
            ) : null}
            {density === "comfortable" && ready ? (
              <p className="mt-1 text-[11px] font-medium text-emerald-700">
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
