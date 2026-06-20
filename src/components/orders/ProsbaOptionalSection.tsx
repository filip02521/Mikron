"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { IconChevronDown } from "@/components/icons/StrokeIcons";
import { HelpHintBubble } from "@/components/ui/HelpHintBubble";
import { cn } from "@/lib/cn";
import {
  prosbaOptionalSectionMeta,
  type ProsbaOptionalSectionKind,
} from "@/lib/orders/prosba-optional-section-ui";

/** Zwijana sekcja opcjonalna — ikona kafelkowa + tytuł + podpowiedź wizualna. */
export function ProsbaOptionalSection({
  kind,
  title,
  description,
  hint,
  hintAriaLabel = "O tej sekcji",
  teaser,
  defaultOpen = false,
  detailsKey,
  open,
  onOpenChange,
  className,
  summaryClassName,
  bodyClassName,
  showOptionalLabel = true,
  children,
}: {
  kind: ProsbaOptionalSectionKind;
  title: string;
  /** Krótki opis pod tytułem — bez rozwijania. */
  description?: string;
  /** Dymek ? — tylko gdy naprawdę potrzebny (nie w typowych sekcjach opcjonalnych). */
  hint?: string;
  hintAriaLabel?: string;
  /** Podgląd wypełnionej treści (np. notatka, klient) — tylko gdy zwinięte. */
  teaser?: string | null;
  defaultOpen?: boolean;
  detailsKey?: string;
  /** Kontrolowane rozwinięcie (np. link z meta-paska). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  summaryClassName?: string;
  bodyClassName?: string;
  showOptionalLabel?: boolean;
  children: ReactNode;
}) {
  const { Icon, tileClassName } = prosbaOptionalSectionMeta(kind);
  const trimmedTeaser = teaser?.trim();
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (defaultOpen && detailsRef.current && open === undefined) {
      detailsRef.current.open = true;
    }
  }, [defaultOpen, detailsKey, open]);

  useEffect(() => {
    if (open === undefined || !detailsRef.current) return;
    detailsRef.current.open = open;
  }, [open]);

  return (
    <details
      ref={detailsRef}
      key={detailsKey}
      onToggle={(event) => {
        onOpenChange?.((event.currentTarget as HTMLDetailsElement).open);
      }}
      className={cn(
        "group rounded-md border border-slate-200/80 bg-slate-50/40 open:bg-white open:shadow-sm",
        className
      )}
    >
      <summary
        className={cn(
          "flex cursor-pointer list-none items-start gap-2.5 px-3 py-2.5 marker:content-none",
          "[&::-webkit-details-marker]:hidden",
          summaryClassName
        )}
      >
        <SectionHeadingIcon tileClassName={tileClassName} className="mt-0.5 h-7 w-7">
          <Icon size={16} strokeWidth={2.25} />
        </SectionHeadingIcon>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="text-xs font-medium leading-snug text-slate-800">{title}</span>
            {showOptionalLabel ? (
              <span className="text-[11px] text-slate-500">(opcjonalnie)</span>
            ) : null}
            {hint ? (
              <HelpHintBubble message={hint} tone="slate" size="md" ariaLabel={hintAriaLabel} />
            ) : null}
          </div>
          {description ? (
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{description}</p>
          ) : null}
          {trimmedTeaser ? (
            <p className="mt-1 truncate text-[11px] font-medium text-slate-600 group-open:hidden">
              {trimmedTeaser}
            </p>
          ) : null}
        </div>

        <IconChevronDown
          size={16}
          className="mt-1 shrink-0 text-slate-400 transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>

      <div className={cn("border-t border-slate-100 px-3 pb-3 pt-2", bodyClassName)}>{children}</div>
    </details>
  );
}
