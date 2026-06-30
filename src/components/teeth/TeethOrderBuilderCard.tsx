"use client";

import { Button } from "@/components/ui/Button";
import { IconClipboardList, IconCircleCheck } from "@/components/icons/StrokeIcons";
import { TeethGroupChips } from "@/components/teeth/TeethGroupChips";
import {
  teethProductLineLabel,
  type TeethKind,
  type TeethLineDetail,
  type TeethManufacturer,
  type TeethProductLine,
} from "@/lib/teeth/teeth-catalog";
import { teethLineDetailsComplete } from "@/lib/teeth/teeth-validation";
import {
  teethProsbaDetailClass,
  teethProsbaIconClass,
  teethProsbaIncompleteDetailClass,
  teethProsbaIncompleteIconClass,
  teethProsbaIncompleteTitleClass,
  teethProsbaShellClass,
  teethProsbaShellIncompleteClass,
  teethProsbaStatusRowClass,
  teethProsbaTitleClass,
} from "@/lib/teeth/teeth-prosba-ui";
import { cn } from "@/lib/cn";

/**
 * Jedyny blok listy zębów przy edycji pozycji — konfiguracja, podgląd i edycja.
 */
export function TeethOrderBuilderCard({
  manufacturer,
  productLine,
  productName,
  defaultKind,
  details,
  disabled,
  onOpenModal,
}: {
  manufacturer: TeethManufacturer;
  productLine?: TeethProductLine | null;
  productName?: string;
  defaultKind?: TeethKind | null;
  details?: TeethLineDetail[];
  disabled?: boolean;
  onOpenModal: () => void;
}) {
  const total = details?.length ?? 0;
  const complete =
    total > 0 &&
    teethLineDetailsComplete({
      teethDetails: details,
      quantity: String(total),
      product: productName,
      adminProductLine: productLine,
      adminManufacturer: manufacturer,
      isTeethProduct: true,
    });
  const lineLabel = productLine ? teethProductLineLabel(productLine) : null;
  const hasList = total > 0;

  const title =
    complete
      ? `Lista zębów${lineLabel ? ` · ${lineLabel}` : ""}`
      : hasList
        ? `Dokończ listę zębów${lineLabel ? ` · ${lineLabel}` : ""}`
        : `Lista zębów${lineLabel ? ` · ${lineLabel}` : ""}`;

  const detail = complete ? (
    <>
      Razem <span className="font-semibold tabular-nums">{total}</span>{" "}
      {total === 1 ? "sztuka" : total < 5 ? "sztuki" : "sztuk"}.
    </>
  ) : hasList ? (
    "Brakuje parametrów w co najmniej jednej pozycji listy."
  ) : (
    <>
      Wpisz pozycje z kartki klienta — ilość zamówienia ustawi się sama.
      {defaultKind ? (
        <>
          {" "}
          Produkt: {defaultKind === "anterior" ? "przednie" : "tylne"}.
        </>
      ) : null}
    </>
  );

  return (
    <div
      role="status"
      className={cn(
        teethProsbaStatusRowClass,
        complete ? teethProsbaShellClass : teethProsbaShellIncompleteClass,
      )}
    >
      {complete ? (
        <IconCircleCheck size={18} strokeWidth={2.25} className={teethProsbaIconClass} aria-hidden />
      ) : (
        <IconClipboardList
          size={18}
          strokeWidth={2.25}
          className={complete ? teethProsbaIconClass : teethProsbaIncompleteIconClass}
          aria-hidden
        />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={complete ? teethProsbaTitleClass : teethProsbaIncompleteTitleClass}>
              {title}
            </p>
            <p className={complete ? teethProsbaDetailClass : teethProsbaIncompleteDetailClass}>
              {detail}
            </p>
            {!complete ? (
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                Stan magazynowy nie jest weryfikowany.
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            className={cn(
              "h-auto shrink-0 px-2 py-1 text-xs font-semibold",
              complete
                ? "text-violet-800 hover:bg-violet-100/80"
                : "text-amber-900 hover:bg-amber-100/80",
            )}
            onClick={onOpenModal}
          >
            {hasList ? "Edytuj listę" : "Otwórz listę"}
          </Button>
        </div>

        {complete ? <TeethGroupChips details={details} className="mt-2" /> : null}
      </div>
    </div>
  );
}
