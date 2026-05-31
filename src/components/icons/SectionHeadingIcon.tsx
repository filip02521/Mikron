import { cn } from "@/lib/cn";

/** Kwadratowa „kafelkowa” ikona przy nagłówku sekcji. */
export function SectionHeadingIcon({
  children,
  tileClassName,
  className,
}: {
  children: React.ReactNode;
  tileClassName: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md [&_svg]:shrink-0",
        tileClassName,
        className
      )}
      aria-hidden
    >
      {children}
    </span>
  );
}
