"use client";

import { OverflowMenu, OverflowMenuItem } from "@/components/ui/OverflowMenu";

export function RequestGroupOverflowMenu({
  headline,
  disabled,
  onEdit,
  onCancel,
  variant = "segment",
  iconOnly = false,
}: {
  headline: string;
  disabled?: boolean;
  onEdit: () => void;
  onCancel: () => void;
  variant?: "standalone" | "segment";
  iconOnly?: boolean;
}) {
  return (
    <OverflowMenu
      label={`Więcej — ${headline}`}
      disabled={disabled}
      align="end"
      variant={variant}
      iconOnly={iconOnly}
    >
      <OverflowMenuItem
        disabled={disabled}
        onClick={() => {
          onEdit();
        }}
      >
        Popraw dane
      </OverflowMenuItem>
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
