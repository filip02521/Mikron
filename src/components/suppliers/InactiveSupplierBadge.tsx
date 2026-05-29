import { Badge } from "@/components/ui/Badge";

export function InactiveSupplierBadge({ className }: { className?: string }) {
  return (
    <Badge variant="default" className={className}>
      Nieaktywny
    </Badge>
  );
}
