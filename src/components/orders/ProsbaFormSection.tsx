import { cn } from "@/lib/cn";
import { panelTypography, salesTypography } from "@/lib/ui/ontime-theme";
import { SectionListLabel, type SectionListAccent } from "@/components/ui/SectionListLabel";
import { HelpHintBubble } from "@/components/ui/HelpHintBubble";
import { mojeShipmentSectionShellClass } from "@/lib/ui/moje-shipment-row-styles";
import type { ReactNode } from "react";

/** Nagłówek bloku w jednej karcie formularza prośby. */
export function ProsbaFormSection({
  title,
  hint,
  hintMode = "tooltip",
  children,
  className,
  domain = "sales",
  accent,
  icon,
  tileClassName,
}: {
  title: string;
  hint?: string;
  /** inline — opis pod tytułem; tooltip — ikona ? z dymkiem (domyślnie). */
  hintMode?: "inline" | "tooltip";
  children: React.ReactNode;
  className?: string;
  /** sales — panel handlowca; panel — zakupy / weryfikacja. */
  domain?: "sales" | "panel";
  /** Wariant jak sekcje w „Moje zamówienia” — kolorowy nagłówek w obramowanej karcie. */
  accent?: SectionListAccent;
  icon?: ReactNode;
  tileClassName?: string;
}) {
  if (accent && icon && tileClassName) {
    return (
      <section className={cn(mojeShipmentSectionShellClass, className)}>
        <SectionListLabel
          title={title}
          hint={hint}
          hintMode={hintMode}
          accent={accent}
          domain={domain}
          icon={icon}
          tileClassName={tileClassName}
        />
        <div className="space-y-3 p-3 sm:p-4">{children}</div>
      </section>
    );
  }

  const titleClass =
    domain === "panel" ? panelTypography.sectionTitle : salesTypography.blockTitle;
  const hintClass =
    domain === "panel" ? panelTypography.sectionDesc : salesTypography.sectionHint;

  return (
    <section className={cn("space-y-2.5", className)}>
      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className={titleClass}>{title}</h3>
          {hint && hintMode === "tooltip" ? (
            <HelpHintBubble
              message={hint}
              tone="slate"
              size="md"
              ariaLabel="O tej sekcji"
            />
          ) : null}
        </div>
        {hint && hintMode === "inline" ? <p className={cn("mt-0.5", hintClass)}>{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}
