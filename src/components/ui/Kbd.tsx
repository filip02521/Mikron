import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Kbd({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        "inline-flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded border border-slate-200/90 bg-slate-50 px-1 font-mono text-[10px] font-medium leading-none text-slate-700",
        className
      )}
    >
      {children}
    </kbd>
  );
}
