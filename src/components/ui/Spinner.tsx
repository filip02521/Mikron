import { cn } from "@/lib/cn";

const sizes = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-[2.5px]",
  lg: "h-11 w-11 border-[3px]",
};

export function Spinner({
  size = "md",
  className,
}: {
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <span
      role="presentation"
      className={cn(
        "inline-block shrink-0 animate-spin rounded-full border-slate-200 border-t-indigo-600",
        sizes[size],
        className
      )}
    />
  );
}
