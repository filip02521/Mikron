"use client";

import {
  OverflowMenu,
  OverflowMenuItem,
  OverflowMenuLabel,
  OverflowMenuSeparator,
} from "@/components/ui/OverflowMenu";
import { cn } from "@/lib/cn";
import {
  procurementFlagDotClass,
  type ProcurementFlagColor,
} from "@/lib/orders/procurement-request-flag";
import { PROCUREMENT_REQUEST_FLAG_COPY } from "@/lib/orders/procurement-request-flag-copy";

export type RequestGroupFlagShortcut = {
  flagId: string;
  label: string;
  color?: ProcurementFlagColor;
};

/** @deprecated alias — skróty ustawiają flagę, nie „przenoszą” ręcznie. */
export type RequestGroupMoveFlagOption = RequestGroupFlagShortcut;

export function RequestGroupOverflowMenu({
  headline,
  disabled,
  onEdit,
  onCancel,
  onOpenSupplierDetails,
  onSetFlag,
  hasFlag = false,
  currentFlagId = null,
  flagShortcuts,
  onSetFlagShortcut,
  onClearFlag,
  /** @deprecated użyj flagShortcuts */
  moveFlagOptions,
  /** @deprecated użyj onSetFlagShortcut */
  onMoveToFlag,
  variant = "segment",
  iconOnly = false,
  className,
}: {
  headline: string;
  disabled?: boolean;
  onEdit: () => void;
  onCancel: () => void;
  /** Panel szczegółów dostawcy (drawer) — jak „Szczegóły” w harmonogramie. */
  onOpenSupplierDetails?: () => void;
  onSetFlag?: () => void;
  /** Gdy grupa ma już flagę — etykiety „zmień / usuń”. */
  hasFlag?: boolean;
  /** Jednogłośna flaga grupy — podświetlenie skrótu. */
  currentFlagId?: string | null;
  flagShortcuts?: RequestGroupFlagShortcut[];
  onSetFlagShortcut?: (flagId: string) => void;
  onClearFlag?: () => void;
  moveFlagOptions?: RequestGroupFlagShortcut[];
  onMoveToFlag?: (flagId: string) => void;
  variant?: "standalone" | "segment";
  iconOnly?: boolean;
  className?: string;
}) {
  const shortcuts = flagShortcuts ?? moveFlagOptions;
  const onShortcut = onSetFlagShortcut ?? onMoveToFlag;
  const showFlagShortcuts = Boolean(shortcuts?.length && onShortcut);
  const showFlagSection = showFlagShortcuts || Boolean(onSetFlag);
  const currentKey = currentFlagId?.toLowerCase() ?? null;

  return (
    <OverflowMenu
      label={`Więcej — ${headline}`}
      disabled={disabled}
      align="end"
      variant={variant}
      iconOnly={iconOnly}
      className={className}
      menuClassName="min-w-[15rem]"
    >
      <OverflowMenuLabel>{PROCUREMENT_REQUEST_FLAG_COPY.overflowSectionRequest}</OverflowMenuLabel>
      <OverflowMenuItem disabled={disabled} onClick={onEdit}>
        {PROCUREMENT_REQUEST_FLAG_COPY.overflowEdit}
      </OverflowMenuItem>
      {onOpenSupplierDetails ? (
        <OverflowMenuItem disabled={disabled} onClick={onOpenSupplierDetails}>
          {PROCUREMENT_REQUEST_FLAG_COPY.overflowSupplierDetails}
        </OverflowMenuItem>
      ) : null}

      {showFlagSection ? (
        <>
          <OverflowMenuSeparator />
          <OverflowMenuLabel>{PROCUREMENT_REQUEST_FLAG_COPY.overflowSectionFlag}</OverflowMenuLabel>
          {showFlagShortcuts
            ? shortcuts!.map((opt) => {
                const isCurrent =
                  currentKey != null && opt.flagId.toLowerCase() === currentKey;
                return (
                  <OverflowMenuItem
                    key={opt.flagId}
                    disabled={disabled}
                    onClick={() => onShortcut?.(opt.flagId)}
                    className={cn(
                      "py-1.5",
                      isCurrent && "bg-indigo-50/70 font-medium text-indigo-950"
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          opt.color
                            ? procurementFlagDotClass(opt.color)
                            : "bg-slate-300"
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                      {isCurrent ? (
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-indigo-500/90">
                          {PROCUREMENT_REQUEST_FLAG_COPY.overflowFlagActive}
                        </span>
                      ) : null}
                    </span>
                  </OverflowMenuItem>
                );
              })
            : null}
          {onSetFlag ? (
            <OverflowMenuItem
              disabled={disabled}
              onClick={onSetFlag}
              className={cn(
                showFlagShortcuts && "mt-0.5 border-t border-slate-100/90 pt-2 text-slate-600"
              )}
            >
              {hasFlag
                ? PROCUREMENT_REQUEST_FLAG_COPY.overflowChange
                : PROCUREMENT_REQUEST_FLAG_COPY.overflowSet}
            </OverflowMenuItem>
          ) : null}
          {hasFlag && onClearFlag ? (
            <OverflowMenuItem disabled={disabled} onClick={onClearFlag}>
              {PROCUREMENT_REQUEST_FLAG_COPY.clear}
            </OverflowMenuItem>
          ) : null}
        </>
      ) : null}

      <OverflowMenuSeparator />
      <OverflowMenuItem danger disabled={disabled} onClick={onCancel}>
        {PROCUREMENT_REQUEST_FLAG_COPY.overflowCancelRequest}
      </OverflowMenuItem>
    </OverflowMenu>
  );
}
