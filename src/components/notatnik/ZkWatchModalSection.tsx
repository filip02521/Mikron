import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";

/** Sekcja w modalu ZK — ten sam rytm co ProsbaFormSection / panel handlowca. */
export function ZkWatchModalSection({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2.5", className)}>
      <div>
        <h3 className={salesTypography.blockTitle}>{title}</h3>
        {hint ? <p className={cn("mt-0.5", salesTypography.sectionHint)}>{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}
