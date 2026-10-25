import { Badge } from "@/components/ui/Badge";
import { zdSupplierPolicyLabel, zdSupplierPolicyShortLabel } from "@/components/zakupy/ZdSupplierOrderPolicyDialog";
import type { ZdAutomatPolicySummary } from "@/lib/data/zd-supplier-order-policy";

/** Wiersz Terminów zamówień. */
export function ZdAutomatPolicyBadge({ policy }: { policy: ZdAutomatPolicySummary }) {
  return (
    <span
      title={`${zdSupplierPolicyLabel(policy)}. Propozycje ZD przygotowuje automat w tym rytmie; Częstotliwość z karty wyznacza tylko przypomnienia w Terminach zamówień.`}
    >
      <Badge variant="info">{zdSupplierPolicyShortLabel(policy)}</Badge>
    </span>
  );
}
