"use client";

import type {
  ZdEstimateCechaOption,
  ZdEstimateGroupOption,
} from "@/app/actions/zd-estimate";
import { IconStar, IconX } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { ZD_ESTIMATE_UI } from "@/lib/orders/zd-estimate-ui-copy";

type GroupChipProps = {
  group: ZdEstimateGroupOption;
  active: boolean;
  disabled?: boolean;
  onSelect: () => void;
  onRemoveFavorite: () => void;
};

export function ZdEstimateFavoriteGroupChip({
  group,
  active,
  disabled,
  onSelect,
  onRemoveFavorite,
}: GroupChipProps) {
  return (
    <div
      className={cn(
        "group/chip inline-flex max-w-full items-stretch overflow-hidden rounded-md border transition",
        active
          ? "border-indigo-300 bg-indigo-50 text-indigo-950 shadow-sm shadow-indigo-900/5"
          : "border-slate-200/90 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
      )}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onSelect}
        aria-pressed={active}
        title={
          group.dniZapasu != null
            ? `${group.supplierName ?? "dostawca"} · zapas ${group.stockLabel} (${group.dniZapasu} d)`
            : "Brak zapasu na karcie — 30 dni"
        }
        className={cn(
          "inline-flex min-h-10 min-w-0 items-center gap-1.5 px-2.5 py-1.5 text-left text-sm transition",
          "rounded-none border-0 bg-transparent shadow-none",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        <span className="max-w-[14rem] truncate font-medium sm:max-w-[16rem]">
          {group.grt_Nazwa}
        </span>
        {group.dniZapasu != null ? (
          <span className="rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-500 ring-1 ring-slate-200/80">
            {group.dniZapasu}d
          </span>
        ) : null}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          onRemoveFavorite();
        }}
        aria-label={ZD_ESTIMATE_UI.prepFavoriteRemoveAria(group.grt_Nazwa)}
        title={ZD_ESTIMATE_UI.prepFavoriteRemoveAria(group.grt_Nazwa)}
        className={cn(
          "inline-flex min-h-10 min-w-9 shrink-0 items-center justify-center border-l border-slate-200/70 text-slate-400 transition",
          "hover:bg-slate-100/90 hover:text-slate-700",
          "opacity-80 sm:opacity-0 sm:group-hover/chip:opacity-100 sm:group-focus-within/chip:opacity-100",
          "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/60",
          "disabled:cursor-not-allowed disabled:opacity-40",
          active && "border-indigo-200/80"
        )}
      >
        <IconX size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

type CechaChipProps = {
  cecha: ZdEstimateCechaOption;
  active: boolean;
  disabled?: boolean;
  onSelect: () => void;
  onRemoveFavorite: () => void;
};

export function ZdEstimateFavoriteCechaChip({
  cecha,
  active,
  disabled,
  onSelect,
  onRemoveFavorite,
}: CechaChipProps) {
  return (
    <div
      className={cn(
        "group/chip inline-flex max-w-full items-stretch overflow-hidden rounded-md border transition",
        active
          ? "border-indigo-300 bg-indigo-50 text-indigo-950 shadow-sm shadow-indigo-900/5"
          : "border-slate-200/90 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
      )}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onSelect}
        aria-pressed={active}
        title={
          cecha.dniZapasu != null
            ? `${cecha.supplierName ?? "dostawca"} · zapas ${cecha.stockLabel} (${cecha.dniZapasu} d)`
            : "Brak zapasu na karcie — 30 dni"
        }
        className={cn(
          "inline-flex min-h-10 min-w-0 items-center gap-1.5 px-2.5 py-1.5 text-left text-sm transition",
          "rounded-none border-0 bg-transparent shadow-none",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        <span className="max-w-[14rem] truncate font-medium sm:max-w-[16rem]">
          {cecha.ctw_Nazwa}
        </span>
        {cecha.dniZapasu != null ? (
          <span className="rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-500 ring-1 ring-slate-200/80">
            {cecha.dniZapasu}d
          </span>
        ) : null}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          onRemoveFavorite();
        }}
        aria-label={ZD_ESTIMATE_UI.prepFavoriteRemoveAria(cecha.ctw_Nazwa)}
        title={ZD_ESTIMATE_UI.prepFavoriteRemoveAria(cecha.ctw_Nazwa)}
        className={cn(
          "inline-flex min-h-10 min-w-9 shrink-0 items-center justify-center border-l border-slate-200/70 text-slate-400 transition",
          "hover:bg-slate-100/90 hover:text-slate-700",
          "opacity-80 sm:opacity-0 sm:group-hover/chip:opacity-100 sm:group-focus-within/chip:opacity-100",
          "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/60",
          "disabled:cursor-not-allowed disabled:opacity-40",
          active && "border-indigo-200/80"
        )}
      >
        <IconX size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

export function ZdEstimateFavoriteStarButton({
  favorited,
  label,
  onToggle,
  className,
}: {
  favorited: boolean;
  label: string;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center transition",
        favorited
          ? "text-amber-500 hover:bg-amber-50"
          : "text-slate-400 hover:bg-slate-50 hover:text-slate-600",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/50",
        className
      )}
      aria-pressed={favorited}
      aria-label={
        favorited
          ? ZD_ESTIMATE_UI.prepFavoriteStarRemoveAria(label)
          : ZD_ESTIMATE_UI.prepFavoriteStarAddAria(label)
      }
      title={
        favorited
          ? ZD_ESTIMATE_UI.prepFavoriteStarRemoveAria(label)
          : ZD_ESTIMATE_UI.prepFavoriteStarAddAria(label)
      }
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      <IconStar size={16} strokeWidth={1.75} filled={favorited} />
    </button>
  );
}
