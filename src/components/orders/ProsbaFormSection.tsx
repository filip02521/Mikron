import { cn } from "@/lib/cn";
import { panelTypography, salesTypography } from "@/lib/ui/ontime-theme";
import { SectionListLabel, type SectionListAccent } from "@/components/ui/SectionListLabel";
import { mojeShipmentSectionShellClass } from "@/lib/ui/moje-shipment-row-styles";
import type { ReactNode } from "react";

/** Nagłówek bloku w jednej karcie formularza prośby. */
export function ProsbaFormSection({
  title,
  hint,
  children,
  className,
  domain = "sales",
  accent,
  icon,
  tileClassName,
}: {
  title: string;
  hint?: string;
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
        <h3 className={titleClass}>{title}</h3>
        {hint ? <p className={cn("mt-0.5", hintClass)}>{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}
