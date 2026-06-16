"use client";

import { useRouter } from "next/navigation";
import { OverflowMenu, OverflowMenuItem } from "@/components/ui/OverflowMenu";

export function ZkWatchOverflowMenu({
  label,
  disabled,
  hasLines,
  linesLabel,
  onOpenLines,
  onEditProsbaScope,
  onRefresh,
  refreshDisabled,
  mojeClientHref,
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
  onEditProsbaScope?: () => void;
  onRefresh?: () => void;
  refreshDisabled?: boolean;
  mojeClientHref: string;
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

  return (
    <OverflowMenu
      label={label}
      disabled={disabled}
      align="end"
      iconOnly
      triggerClassName="h-10 w-10 sm:h-7 sm:w-7"
    >
      {archived ? (
        <>
          {hasLines ? (
            <OverflowMenuItem disabled={disabled} onClick={onOpenLines}>
              Szczegóły i towar ({linesLabel})
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
          {onEditProsbaScope ? (
            <OverflowMenuItem disabled={disabled} onClick={onEditProsbaScope}>
              Zakres prośby
            </OverflowMenuItem>
          ) : null}
          {!readOnly && onRefresh ? (
            <OverflowMenuItem disabled={refreshDisabled || disabled} onClick={onRefresh}>
              Odśwież z Subiekta
            </OverflowMenuItem>
          ) : null}
          <OverflowMenuItem disabled={disabled} onClick={() => router.push(mojeClientHref)}>
            Prośby klienta
          </OverflowMenuItem>
          {!readOnly && onClose ? (
            <OverflowMenuItem danger disabled={closeDisabled || disabled} onClick={onClose}>
              Zamknij sprawę
            </OverflowMenuItem>
          ) : null}
        </>
      )}
    </OverflowMenu>
  );
}
