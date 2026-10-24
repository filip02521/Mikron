import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { zdSupplierPolicyLabel, zdSupplierPolicyShortLabel } from "@/components/zakupy/ZdSupplierOrderPolicyDialog";
import type { ZdAutomatPolicySummary } from "@/lib/data/zd-supplier-order-policy";

/**
 * Dostawca w automacie ZD: propozycje powstają w rytmie strategii, a cykl z karty dalej działa — Częstotliwość
 * daje przypomnienia w Terminach zamówień, Zapas to okno sprzedaży, z którego automat liczy tempo.
 */
const MEANING =
  "Propozycje ZD przygotowuje automat w tym rytmie. Częstotliwość z karty wyznacza tylko przypomnienia w Terminach zamówień, a Zapas - okno sprzedaży, z którego automat liczy tempo.";

/** Wiersz Terminów zamówień. */
export function ZdAutomatPolicyBadge({ policy }: { policy: ZdAutomatPolicySummary }) {
  return (
    <span title={`${zdSupplierPolicyLabel(policy)}. ${MEANING}`}>
      <Badge variant="info">{zdSupplierPolicyShortLabel(policy)}</Badge>
    </span>
  );
}

/** Sekcja „Cykl zamówień” w karcie dostawcy. */
export function ZdAutomatPolicyCardNote({ policy }: { policy: ZdAutomatPolicySummary }) {
  return (
    <div className="mb-4 rounded-md border border-indigo-200 bg-white px-3 py-2.5 text-xs leading-relaxed text-slate-700">
      <p className="font-semibold text-indigo-800">{zdSupplierPolicyLabel(policy)}</p>
      <p className="mt-0.5">
        {MEANING}{" "}
        <Link href="/zakupy/automat" className="font-medium text-indigo-700 underline-offset-2 hover:underline">
          Ustawienia automatu
        </Link>
      </p>
    </div>
  );
}
