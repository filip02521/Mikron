import { HelpHintBubble } from "@/components/ui/HelpHintBubble";
import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";

/** Sekcja w modalu ZK — ten sam rytm co ProsbaFormSection / panel handlowca. */
export function ZkWatchModalSection({
  title,
  hint,
  hintMode = "tooltip",
  hintAriaLabel = "O tej sekcji",
  children,
  className,
}: {
  title: string;
  hint?: string;
  /** inline — opis pod tytułem; tooltip — ikona ? (domyślnie). */
  hintMode?: "inline" | "tooltip";
  hintAriaLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2.5", className)}>
      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className={salesTypography.blockTitle}>{title}</h3>
          {hint && hintMode === "tooltip" ? (
            <HelpHintBubble
              message={hint}
              tone="slate"
              size="md"
              ariaLabel={hintAriaLabel}
            />
          ) : null}
        </div>
        {hint && hintMode === "inline" ? (
          <p className={cn("mt-0.5", salesTypography.sectionHint)}>{hint}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
