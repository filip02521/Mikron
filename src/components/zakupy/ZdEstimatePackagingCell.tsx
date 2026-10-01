"use client";

import {
  formatZdPackCompactLabel,
  formatZdPackHint,
  formatZdPackTableRatioLabel,
  formatZdPackUnitsPerLabelHint,
  isPackagingPackagesMode,
  type ZdPackOrderQty,
} from "@/lib/orders/zd-estimate-packaging";
import { formatZdEstimateTableQty } from "@/lib/orders/zd-estimate-table-qty";
import { cn } from "@/lib/cn";
import { controlFocusClass } from "@/lib/ui/ontime-theme";

/**
 * Kolumna „Opak.” — jedyne miejsce w wierszu na definicję opakowania
 * (nie miesza się z Dost. / Sprzed. / Cel).
 * W komórce: liczba + krótki skrót; pełna etykieta w title.
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
  const compact = formatZdPackCompactLabel(label);
  const orderMult =
    packagesMode && qty.orderMultiple >= 2 ? qty.orderMultiple : null;
  const title = qty.hasPackaging
    ? [
        formatZdPackHint(qty) ||
          (packagesMode
            ? `${formatZdPackUnitsPerLabelHint(qty.unitsPerPackage, label)} — na dokumencie ZD wpisujesz paczki`
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
  const ratio = qty.hasPackaging
    ? packagesMode
      ? formatZdPackTableRatioLabel(label)
      : "×N"
    : null;
  const modeSub = !qty.hasPackaging
    ? "ustaw"
    : conflict
      ? "Konflikt"
      : packagesMode
        ? orderMult != null
          ? `co ${orderMult}`
          : "paczki"
        : "dobicie";

  return (
    <button
      type="button"
      onClick={onEdit}
      disabled={disabled || pending}
      title={title}
      aria-label={
        qty.hasPackaging
          ? `Opakowanie: ${primary} szt na 1 ${label}${
              compact.toLowerCase() !== label.toLowerCase()
                ? ` (${compact})`
                : ""
            }${orderMult != null ? ` · co ${orderMult}` : ""}. Edytuj`
          : "Ustaw opakowanie"
      }
      className={cn(
        controlFocusClass,
        "zd-estimate-pack-cell inline-flex max-w-full flex-col items-center gap-0.5 rounded-md px-1 py-1 text-center transition",
        "hover:bg-indigo-50/80 disabled:cursor-not-allowed disabled:opacity-50",
        conflict && "ring-1 ring-amber-400/80 bg-amber-50/70"
      )}
    >
      <span
        className={cn(
          "zd-est-qty--c tabular-nums leading-none",
          !qty.hasPackaging && "zd-est-qty--dash zd-est-qty--muted",
          conflict && "zd-est-qty--warn"
        )}
      >
        {primary}
      </span>
      {ratio ? (
        <span className="zd-est-unit zd-est-pack-ratio whitespace-nowrap">
          {ratio}
        </span>
      ) : null}
      <span
        className={cn(
          "zd-est-pack-cell-sub text-[10px] font-medium leading-none tracking-tight",
          !qty.hasPackaging && "text-slate-400",
          qty.hasPackaging && conflict && "text-amber-900",
          qty.hasPackaging && !conflict && "text-slate-500"
        )}
      >
        {modeSub}
      </span>
    </button>
  );
}
