"use client";

import {
  formatZdPackHint,
  isPackagingPackagesMode,
  type ZdPackOrderQty,
} from "@/lib/orders/zd-estimate-packaging";
import { formatZdEstimateTableQty } from "@/lib/orders/zd-estimate-table-qty";
import { cn } from "@/lib/cn";
import { controlFocusClass } from "@/lib/ui/ontime-theme";

/**
 * Kolumna „Opak.” — jedyne miejsce w wierszu na definicję opakowania
 * (nie miesza się z Dost. / Sprzed. / Cel).
 */
export function ZdEstimatePackagingCell({
  qty,
  conflict = false,
  disabled,
  pending,
  onEdit,
}: {
  qty: ZdPackOrderQty;
  conflict?: boolean;
  disabled?: boolean;
  pending?: boolean;
  onEdit: () => void;
}) {
  const packagesMode = isPackagingPackagesMode(qty.documentUnitMode);
  const label = qty.packageLabel.trim() || "op.";
  const title = qty.hasPackaging
    ? [
        formatZdPackHint(qty) ||
          (packagesMode
            ? `${qty.unitsPerPackage} szt / 1 ${label} — na dokumencie ZD wpisujesz paczki`
            : `Dobijanie Do ZD do wielokrotności ${qty.unitsPerPackage} szt`),
        conflict
          ? "Konflikt z parą montaż/demontaż — ujednolić opakowanie."
          : null,
        "Kliknij, żeby zmienić opakowanie.",
      ]
        .filter(Boolean)
        .join(" ")
    : "Bez opakowania (1:1 sztuki). Kliknij, żeby ustawić paczkę lub dobicie.";

  const primary = qty.hasPackaging
    ? formatZdEstimateTableQty(qty.unitsPerPackage)
    : "1:1";
  const unit = qty.hasPackaging
    ? packagesMode
      ? `szt/${label}`
      : "×N"
    : null;

  return (
    <button
      type="button"
      onClick={onEdit}
      disabled={disabled || pending}
      title={title}
      aria-label={
        qty.hasPackaging
          ? `Opakowanie: ${primary} ${unit ?? ""}. Edytuj`
          : "Ustaw opakowanie"
      }
      className={cn(
        controlFocusClass,
        "zd-estimate-pack-cell inline-flex max-w-full flex-col items-center gap-0.5 rounded-md px-1.5 py-1 text-center transition",
        "hover:bg-indigo-50/80 disabled:cursor-not-allowed disabled:opacity-50",
        conflict && "ring-1 ring-amber-400/80 bg-amber-50/70"
      )}
    >
      <span className="inline-flex max-w-full items-baseline gap-0.5 leading-none">
        <span
          className={cn(
            "zd-est-qty--c tabular-nums",
            !qty.hasPackaging && "zd-est-qty--dash zd-est-qty--muted",
            conflict && "zd-est-qty--warn"
          )}
        >
          {primary}
        </span>
        {unit ? <span className="zd-est-unit truncate">{unit}</span> : null}
      </span>
      {qty.hasPackaging ? (
        <span
          className={cn(
            "zd-est-pack-cell-sub text-[10px] font-medium leading-none tracking-tight",
            conflict ? "text-amber-900" : "text-slate-500"
          )}
        >
          {conflict
            ? "Konflikt"
            : packagesMode
              ? "paczki na ZD"
              : "dobicie szt."}
        </span>
      ) : (
        <span className="zd-est-pack-cell-sub text-[10px] font-medium leading-none tracking-tight text-slate-400">
          ustaw
        </span>
      )}
    </button>
  );
}
