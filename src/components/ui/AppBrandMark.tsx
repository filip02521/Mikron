import { cn } from "@/lib/cn";
import { brandMarkClass } from "@/lib/ui/brand";

export function AppBrandMark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "sm"
      ? "h-8 w-8 rounded-lg text-xs"
      : size === "lg"
        ? "h-14 w-14 rounded-2xl text-xl"
        : "";

  return (
    <span
      className={cn(brandMarkClass, sizeClass, className)}
      aria-hidden
    >
      SD
    </span>
  );
}
