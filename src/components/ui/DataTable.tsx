import { forwardRef } from "react";
import { cn } from "@/lib/cn";

/** Opakowanie tabeli z poprawnym layoutem i paddingiem w kartach */
export function TableScroll({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("table-scroll -mx-px overflow-x-auto px-6 pb-6", className)}>
      {children}
    </div>
  );
}

export const DataTable = forwardRef<
  HTMLTableElement,
  {
    children: React.ReactNode;
    className?: string;
  }
>(function DataTable({ children, className }, ref) {
  return (
    <table ref={ref} className={cn("data-table", className)}>
      {children}
    </table>
  );
});

DataTable.displayName = "DataTable";
