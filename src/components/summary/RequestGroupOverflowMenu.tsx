"use client";

import { OverflowMenu, OverflowMenuItem } from "@/components/ui/OverflowMenu";
import { PROCUREMENT_REQUEST_FLAG_COPY } from "@/lib/orders/procurement-request-flag-copy";

export function RequestGroupOverflowMenu({
  headline,
  disabled,
  onEdit,
  onCancel,
  onSetFlag,
  hasFlag = false,
  variant = "segment",
  iconOnly = false,
  className,
}: {
  headline: string;
  disabled?: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSetFlag?: () => void;
  /** Gdy grupa ma już flagę — etykieta „Zmień flagę…”. */
  hasFlag?: boolean;
  variant?: "standalone" | "segment";
  iconOnly?: boolean;
  className?: string;
}) {
  return (
    <OverflowMenu
      label={`Więcej — ${headline}`}
      disabled={disabled}
      align="end"
      variant={variant}
      iconOnly={iconOnly}
      className={className}
    >
      <OverflowMenuItem
        disabled={disabled}
        onClick={() => {
          onEdit();
        }}
      >
        Popraw dane
      </OverflowMenuItem>
      {onSetFlag ? (
        <OverflowMenuItem
          disabled={disabled}
          onClick={() => {
            onSetFlag();
          }}
        >
          {hasFlag
            ? PROCUREMENT_REQUEST_FLAG_COPY.overflowChange
            : PROCUREMENT_REQUEST_FLAG_COPY.overflowSet}
        </OverflowMenuItem>
      ) : null}
      <OverflowMenuItem
        danger
        disabled={disabled}
        onClick={() => {
          onCancel();
        }}
      >
        Anuluj prośbę
      </OverflowMenuItem>
    </OverflowMenu>
  );
}
