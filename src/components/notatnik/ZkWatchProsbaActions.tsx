"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { IconCircleCheck, IconPackageCheck } from "@/components/icons/StrokeIcons";
import type { ZkWatchProsbaCardAction } from "@/lib/sales/zk-watch-line-ui-state";
import {
  zkWatchRowActionPrimaryClass,
  zkWatchRowActionSecondaryClass,
} from "@/lib/ui/zk-watch-row-action-styles";

export function ZkWatchProsbaActions({
  archived,
  pending,
  prosbaCardAction,
  prosbaHref,
  prosbaInTokuHref,
  onProsbaClick,
  uncoveredCount,
  buttonLabel,
  teethDraftsIncomplete = false,
  teethCatalogUnavailable = false,
  canEditTeethDrafts = true,
  onTeethDraftRequested,
}: {
  archived?: boolean;
  pending?: boolean;
  prosbaCardAction: ZkWatchProsbaCardAction;
  prosbaHref: string;
  prosbaInTokuHref: string;
  onProsbaClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  uncoveredCount: number;
  /** Etykieta po filtrze stanu magazynowego (domyślnie z action.label). */
  buttonLabel?: string;
  /** Brak kompletnych list zębów — zablokuj create, pokaż uzupełnienie. */
  teethDraftsIncomplete?: boolean;
  /** Katalog zębów niedostępny — zablokuj create bez otwierania pustego modala. */
  teethCatalogUnavailable?: boolean;
  /** false w tour/readOnly — nie pokazuj martwego CTA uzupełniania. */
  canEditTeethDrafts?: boolean;
  onTeethDraftRequested?: () => void;
}) {
  if (archived) return null;

  if (prosbaCardAction.kind === "none") return null;

  if (prosbaCardAction.kind === "covered") {
    return null;
  }

  const label = buttonLabel ?? prosbaCardAction.label;

  if (prosbaCardAction.kind === "view_open") {
    return (
      <Link
        href={prosbaInTokuHref}
        title="Przejdź do aktywnej prośby"
        className={zkWatchRowActionSecondaryClass}
        aria-disabled={pending || undefined}
        onClick={pending ? (event) => event.preventDefault() : undefined}
      >
        <IconCircleCheck size={13} className="shrink-0" strokeWidth={2.25} />
        {label}
      </Link>
    );
  }

  if (teethCatalogUnavailable) {
    return (
      <span
        className={zkWatchRowActionSecondaryClass}
        aria-disabled
        title="Katalog zębów jest chwilowo niedostępny — odśwież stronę i spróbuj ponownie"
      >
        Katalog zębów niedostępny
      </span>
    );
  }

  if (teethDraftsIncomplete) {
    if (!canEditTeethDrafts) {
      return (
        <span
          className={zkWatchRowActionSecondaryClass}
          aria-disabled
          title="Najpierw uzupełnij listę zębów dla pozycji ZK"
        >
          Uzupełnij listę zębów
        </span>
      );
    }
    return (
      <button
        type="button"
        className={zkWatchRowActionSecondaryClass}
        disabled={pending}
        title="Najpierw uzupełnij listę zębów dla pozycji ZK"
        onClick={() => onTeethDraftRequested?.()}
      >
        Uzupełnij listę zębów
      </button>
    );
  }

  const title =
    prosbaCardAction.kind === "supplement" && uncoveredCount > 0
      ? `${uncoveredCount} ${uncoveredCount === 1 ? "pozycja" : "pozycji"} do uzupełnienia w prośbie`
      : undefined;

  return (
    <Link
      href={prosbaHref}
      onClick={(event) => {
        if (pending) {
          event.preventDefault();
          return;
        }
        onProsbaClick(event);
      }}
      title={title}
      className={zkWatchRowActionPrimaryClass}
      aria-disabled={pending || undefined}
    >
      <IconPackageCheck size={13} className="shrink-0" strokeWidth={2.25} />
      {label}
    </Link>
  );
}
