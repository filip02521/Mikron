import { Badge } from "@/components/ui/Badge";
import { OC_LINE_KIND_LABELS, OC_STATUS_LABELS, type OcCheck, type OcCheckLine, type OcCheckStatus } from "@/lib/oc-check/types";
import { gmailThreadUrl } from "@/lib/oc-check/view";
import { OcCheckResolveButton } from "./OcCheckResolveButton";

const STATUS_VARIANT: Record<OcCheckStatus, "default" | "success" | "warning" | "info" | "danger"> = {
  zgodne: "success",
  rozbieznosci: "warning",
  czeka_na_nas: "info",
  brak_oc: "default",
  nie_da_sie: "default",
};

const qtyFormat = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 3 });
const priceFormat = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const dateTimeFormat = new Intl.DateTimeFormat("pl-PL", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Warsaw",
});

function qty(value: number | null, unit: string): string {
  if (value === null) return "—";
  return unit ? `${qtyFormat.format(value)} ${unit}` : qtyFormat.format(value);
}

function price(value: number | null, currency: string): string | null {
  if (value === null) return null;
  return currency ? `${priceFormat.format(value)} ${currency}` : priceFormat.format(value);
}

function LineRow({ line }: { line: OcCheckLine }) {
  const ordered = price(line.priceOrdered, line.currency);
  const confirmed = price(line.priceConfirmed, line.currency);
  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="py-2 pr-3 font-mono text-xs text-slate-700">{line.symbol || "—"}</td>
      <td className="py-2 pr-3 text-slate-700">{line.name || "—"}</td>
      <td className="py-2 pr-3 whitespace-nowrap tabular-nums text-slate-900">
        {qty(line.qtyOrdered, line.unitOrdered)} → {qty(line.qtyConfirmed, line.unitConfirmed)}
        {ordered || confirmed ? (
          <span className="block text-xs text-slate-500">
            {ordered ?? "—"} → {confirmed ?? "—"}
          </span>
        ) : null}
      </td>
      <td className="py-2 pr-3 whitespace-nowrap text-slate-600">{OC_LINE_KIND_LABELS[line.kind]}</td>
      <td className="py-2 text-slate-600">
        {line.note}
        {line.deliveryDate ? <span className="block text-xs text-slate-500">termin {line.deliveryDate}</span> : null}
      </td>
    </tr>
  );
}

export function OcCheckCard({ check }: { check: OcCheck }) {
  const threadUrl = gmailThreadUrl(check.mailbox, check.gmailThreadId);
  const differences = check.lines.filter((l) => l.kind !== "ok");
  const title = [check.supplierName, check.ocNumber ? `OC ${check.ocNumber}` : null].filter(Boolean).join(" · ");

  return (
    <li className="rounded-[var(--radius-panel)] border border-slate-200 bg-[var(--card)] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[0.9375rem] font-semibold tracking-tight text-slate-900">{title}</h3>
            <Badge variant={STATUS_VARIANT[check.status]}>{OC_STATUS_LABELS[check.status]}</Badge>
            {check.priority === 2 && !check.resolvedAt ? <Badge variant="danger">Pilne</Badge> : null}
          </div>
          <p className="text-xs text-slate-500">
            {[
              check.zdNumber ? `ZD ${check.zdNumber}` : "ZD nieprzypisane",
              check.linesTotal !== null ? `${check.linesOk} z ${check.linesTotal} pozycji zgodnych` : null,
              check.ocReceivedAt ? `otrzymano ${dateTimeFormat.format(new Date(check.ocReceivedAt))}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {check.summary ? <p className="text-sm leading-relaxed text-slate-600">{check.summary}</p> : null}
          {check.nextStep && !check.resolvedAt ? (
            <p className="text-sm leading-relaxed text-slate-900">
              <span className="font-medium">Ruch:</span> {check.nextStep}
            </p>
          ) : null}
          {check.resolvedAt ? (
            <p className="text-xs text-slate-500">
              Wyjaśnione {dateTimeFormat.format(new Date(check.resolvedAt))}
              {check.resolvedByName ? ` · ${check.resolvedByName}` : ""}
              {check.resolutionNote ? ` · ${check.resolutionNote}` : ""}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-row items-start gap-3 sm:flex-col sm:items-end">
          <OcCheckResolveButton id={check.id} resolved={Boolean(check.resolvedAt)} />
          {threadUrl ? (
            <a
              href={threadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-indigo-700 transition-colors duration-200 hover:text-indigo-900 hover:underline"
            >
              Wątek w Gmailu
            </a>
          ) : null}
        </div>
      </div>

      {differences.length > 0 ? (
        <details className="mt-4 group">
          <summary className="cursor-pointer text-sm font-medium text-slate-700 transition-colors duration-200 hover:text-slate-900">
            Różnice w pozycjach ({differences.length})
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="pb-2 pr-3 font-medium">Symbol</th>
                  <th className="pb-2 pr-3 font-medium">Nazwa</th>
                  <th className="pb-2 pr-3 font-medium">Zamówiono → OC</th>
                  <th className="pb-2 pr-3 font-medium">Rodzaj</th>
                  <th className="pb-2 font-medium">Uwaga</th>
                </tr>
              </thead>
              <tbody>
                {differences.map((line) => (
                  <LineRow key={line.position} line={line} />
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </li>
  );
}
