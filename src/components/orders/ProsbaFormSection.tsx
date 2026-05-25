import { cn } from "@/lib/cn";

/** Nagłówek bloku w jednej karcie formularza prośby. */
export function ProsbaFormSection({
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
    <section className={cn("space-y-3", className)}>
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {hint ? (
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{hint}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
