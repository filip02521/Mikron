import { cn } from "@/lib/cn";
import { panelTypography, salesTypography } from "@/lib/ui/ontime-theme";

/** Nagłówek bloku w jednej karcie formularza prośby. */
export function ProsbaFormSection({
  title,
  hint,
  children,
  className,
  domain = "sales",
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
  /** sales — panel handlowca; panel — zakupy / weryfikacja. */
  domain?: "sales" | "panel";
}) {
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
