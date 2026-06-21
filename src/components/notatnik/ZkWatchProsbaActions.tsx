"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { Button } from "@/components/ui/Button";
import type { ZkWatchProsbaCardAction } from "@/lib/sales/zk-watch-line-ui-state";
import { ZkWatchProsbaCoveredChip } from "./ZkWatchProsbaCoveredChip";

export function ZkWatchProsbaActions({
  archived,
  pending,
  prosbaCardAction,
  prosbaHref,
  prosbaInTokuHref,
  onProsbaClick,
  uncoveredCount,
}: {
  archived?: boolean;
  pending?: boolean;
  prosbaCardAction: ZkWatchProsbaCardAction;
  prosbaHref: string;
  prosbaInTokuHref: string;
  onProsbaClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  uncoveredCount: number;
}) {
  if (archived) return null;

  if (prosbaCardAction.kind === "none") return null;

  if (prosbaCardAction.kind === "covered") {
    return <ZkWatchProsbaCoveredChip reason={prosbaCardAction.reason} size="compact" />;
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

  return (
    <Link href={prosbaHref} onClick={onProsbaClick} title={title}>
      <Button
        type="button"
        size="sm"
        variant="primary"
        className="h-8 px-2.5 text-[0.68rem] sm:h-7"
        disabled={pending}
      >
        {prosbaCardAction.label}
      </Button>
    </Link>
  );
}
