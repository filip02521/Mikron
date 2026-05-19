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

export function DataTable({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <table className={cn("data-table", className)}>
      {children}
    </table>
  );
}
