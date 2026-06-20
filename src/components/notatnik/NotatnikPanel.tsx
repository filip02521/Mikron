import type { ReactNode } from "react";
import { SectionListLabel, type SectionListAccent } from "@/components/ui/SectionListLabel";
import { cn } from "@/lib/cn";
import { mojeShipmentSectionShellClass } from "@/lib/ui/moje-shipment-row-styles";
import { sectionIconTileBrandClass } from "@/lib/ui/ontime-theme";

export function NotatnikPanel({
  title,
  description,
  count,
  icon,
  tileClassName = sectionIconTileBrandClass,
  domain = "sales",
  accent = "neutral",
  badges,
  children,
  className,
  bodyClassName,
  flushBody = false,
}: {
  title: string;
  description?: string;
  count?: number;
  icon: ReactNode;
  tileClassName?: string;
  domain?: "sales" | "panel";
  accent?: SectionListAccent;
  badges?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Lista przy krawędzi sekcji — jak wiersze prośb w /moje. */
  flushBody?: boolean;
}) {
  return (
    <section className={cn(mojeShipmentSectionShellClass, className)}>
      <SectionListLabel
        domain={domain}
        title={title}
        hint={description}
        hintMode="tooltip"
        count={count}
        badges={badges}
        accent={accent}
        icon={icon}
        tileClassName={tileClassName}
      />
      <div className={cn(flushBody ? "space-y-3" : "p-3 sm:p-4", bodyClassName)}>{children}</div>
    </section>
  );
}
