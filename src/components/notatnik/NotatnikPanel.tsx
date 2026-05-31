import type { ReactNode } from "react";
import { SectionListLabel } from "@/components/ui/SectionListLabel";
import { cn } from "@/lib/cn";
import { mojeShipmentSectionShellClass } from "@/lib/ui/moje-shipment-row-styles";
import { sectionIconTileBrandClass } from "@/lib/ui/ontime-theme";

export function NotatnikPanel({
  title,
  description,
  count,
  icon,
  tileClassName = sectionIconTileBrandClass,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  description?: string;
  count?: number;
  icon: ReactNode;
  tileClassName?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn(mojeShipmentSectionShellClass, className)}>
      <SectionListLabel
        title={title}
        hint={description}
        count={count}
        icon={icon}
        tileClassName={tileClassName}
      />
      <div className={cn("p-3 sm:p-4", bodyClassName)}>{children}</div>
    </section>
  );
}
