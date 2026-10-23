import { IconAlertCircle, IconInfoCircle } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import type { ZdAutoProposal, ZdAutoProposalLine } from "@/lib/data/zd-auto-proposals";
import { zdProposalMinimumNotice } from "@/lib/orders/zd-proposal-minimum-notice";

/**
 * Minimum zamówienia / darmowa dostawa propozycji (zadanie 5): odłożona, dopełniona, poniżej progu,
 * pozycje bez ceny. `value`/`lines` — stan po poprawkach w panelu (domyślnie propozycja jak policzona).
 */
export function ZdProposalMinimumNotice({
  proposal,
  value,
  lines,
}: {
  proposal: ZdAutoProposal;
  value?: number;
  lines?: ZdAutoProposalLine[];
}) {
  const items = zdProposalMinimumNotice(proposal, value, lines);
  if (!items.length) return null;
  const strong = items.filter((i) => i.tone !== "muted");
  const muted = items.filter((i) => i.tone === "muted");
  return (
    <div className="space-y-1.5">
      {strong.map((i) => (
        <p
          key={i.text}
          className={cn(
            "flex items-start gap-2 rounded-md px-3 py-2 text-sm",
            i.tone === "warning" ? "bg-amber-50 text-amber-900" : "bg-indigo-50 text-indigo-900"
          )}
        >
          {i.tone === "warning" ? (
            <IconAlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" aria-hidden />
          ) : (
            <IconInfoCircle size={16} className="mt-0.5 shrink-0 text-indigo-600" aria-hidden />
          )}
          <span className="min-w-0">{i.text}</span>
        </p>
      ))}
      {muted.length ? <p className="text-xs text-slate-600">{muted.map((i) => i.text).join(" ")}</p> : null}
    </div>
  );
}
