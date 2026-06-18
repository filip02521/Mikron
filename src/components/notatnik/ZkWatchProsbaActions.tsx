"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { ZkWatchProsbaCardAction } from "@/lib/sales/zk-watch-line-ui-state";
import { salesTypography } from "@/lib/ui/ontime-theme";

export function ZkWatchProsbaActions({
  archived,
  pending,
  prosbaCardAction,
  prosbaHref,
  prosbaInTokuHref,
  onProsbaClick,
  onSetupScope,
  uncoveredCount,
  prosbaLabel,
  prosbaDisabled = false,
  prosbaLoading = false,
}: {
  archived?: boolean;
  pending?: boolean;
  prosbaCardAction: ZkWatchProsbaCardAction;
  prosbaHref: string;
  prosbaInTokuHref: string;
  onProsbaClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  onSetupScope: () => void;
  uncoveredCount: number;
  /** Nadpisanie etykiety po filtrze stanu magazynowego. */
  prosbaLabel?: string;
  prosbaDisabled?: boolean;
  /** Trwa pobieranie stanu z Subiekta — neutralny wygląd zamiast wyłączonego CTA. */
  prosbaLoading?: boolean;
}) {
  if (archived) return null;

  if (prosbaCardAction.kind === "none") return null;

  if (prosbaCardAction.kind === "setup_required") {
    return (
      <Button
        type="button"
        size="sm"
        variant="primary"
        className="h-8 px-2.5 text-[0.68rem] sm:h-7"
        disabled={pending}
        onClick={onSetupScope}
      >
        {prosbaCardAction.label}
      </Button>
    );
  }

  if (prosbaCardAction.kind === "covered") {
    return (
      <span
        className={cn(
          "px-1 text-[0.68rem] font-medium text-slate-500",
          salesTypography.rowMeta
        )}
        title="Wszystkie pozycje do zamówienia są już obsłużone"
      >
        {prosbaCardAction.label}
      </span>
    );
  }

  if (prosbaCardAction.kind === "view_open") {
    return (
      <Link href={prosbaInTokuHref} title="Przejdź do aktywnej prośby">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 px-2.5 text-[0.68rem] sm:h-7"
          disabled={pending}
        >
          {prosbaCardAction.label}
        </Button>
      </Link>
    );
  }

  const title =
    prosbaCardAction.kind === "supplement" && uncoveredCount > 0
      ? `${uncoveredCount} ${uncoveredCount === 1 ? "pozycja" : "pozycji"} do uzupełnienia w prośbie`
      : undefined;

  const label = prosbaLabel ?? prosbaCardAction.label;
  const disabled = pending || prosbaDisabled;

  if (prosbaDisabled) {
    return (
      <Button
        type="button"
        size="sm"
        variant={prosbaLoading ? "secondary" : "primary"}
        className="h-8 px-2.5 text-[0.68rem] sm:h-7"
        disabled
        title={title}
      >
        {label}
      </Button>
    );
  }

  return (
    <Link href={prosbaHref} onClick={onProsbaClick} title={title}>
      <Button
        type="button"
        size="sm"
        variant="primary"
        className="h-8 px-2.5 text-[0.68rem] sm:h-7"
        disabled={disabled}
      >
        {label}
      </Button>
    </Link>
  );
}
