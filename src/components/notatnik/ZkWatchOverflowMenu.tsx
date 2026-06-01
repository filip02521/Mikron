"use client";

import { useRouter } from "next/navigation";
import { OverflowMenu, OverflowMenuItem } from "@/components/ui/OverflowMenu";

export function ZkWatchOverflowMenu({
  label,
  disabled,
  hasLines,
  linesLabel,
  onOpenLines,
  onRefresh,
  refreshDisabled,
  mojeClientHref,
  onNote,
  noteLabel,
  onClose,
  closeDisabled,
  onRestore,
  restoreDisabled,
  onDelete,
  deleteDisabled,
  archived,
  readOnly,
}: {
  label: string;
  disabled?: boolean;
  hasLines: boolean;
  linesLabel: string;
  onOpenLines: () => void;
  onRefresh?: () => void;
  refreshDisabled?: boolean;
  mojeClientHref: string;
  onNote?: () => void;
  noteLabel: string;
  onClose?: () => void;
  closeDisabled?: boolean;
  onRestore?: () => void;
  restoreDisabled?: boolean;
  onDelete?: () => void;
  deleteDisabled?: boolean;
  archived?: boolean;
  readOnly?: boolean;
}) {
  const router = useRouter();

  const menu = (
    triggerClassName: string
  ) => (
    <OverflowMenu
      label={label}
      disabled={disabled}
      align="end"
      iconOnly
      triggerClassName={triggerClassName}
    >
        {archived ? (
          <>
            {hasLines ? (
              <OverflowMenuItem disabled={disabled} onClick={onOpenLines}>
                Lista towaru ({linesLabel})
              </OverflowMenuItem>
            ) : null}
            {onRestore ? (
              <OverflowMenuItem disabled={restoreDisabled} onClick={onRestore}>
                Przywróć na listę
              </OverflowMenuItem>
            ) : null}
            {onDelete ? (
              <OverflowMenuItem danger disabled={deleteDisabled} onClick={onDelete}>
                Usuń na stałe
              </OverflowMenuItem>
            ) : null}
          </>
        ) : (
          <>
            {hasLines ? (
              <OverflowMenuItem disabled={disabled} onClick={onOpenLines}>
                Lista towaru ({linesLabel})
              </OverflowMenuItem>
            ) : null}
            {!readOnly && onRefresh ? (
              <OverflowMenuItem disabled={refreshDisabled || disabled} onClick={onRefresh}>
                Odśwież z Subiekta
              </OverflowMenuItem>
            ) : null}
            <OverflowMenuItem
              disabled={disabled}
              onClick={() => router.push(mojeClientHref)}
            >
              Prośby klienta
            </OverflowMenuItem>
            {!readOnly && onNote ? (
              <OverflowMenuItem disabled={disabled} onClick={onNote}>
                {noteLabel}
              </OverflowMenuItem>
            ) : null}
            {!readOnly && onClose ? (
              <OverflowMenuItem danger disabled={closeDisabled || disabled} onClick={onClose}>
                Zamknij sprawę
              </OverflowMenuItem>
            ) : null}
          </>
        )}
    </OverflowMenu>
  );

  return menu("h-7 w-7");
}
