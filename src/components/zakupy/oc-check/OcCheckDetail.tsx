import { Badge } from "@/components/ui/Badge";
import { DetailHeader, detailLinkClass } from "@/components/zakupy/asystent/workspace";
import { OC_LINE_KIND_LABELS, OC_STATUS_LABELS, type OcCheck, type OcCheckLine } from "@/lib/oc-check/types";
import { gmailThreadUrl } from "@/lib/oc-check/view";
import { OcCheckResolveButton } from "./OcCheckResolveButton";
import { OC_STATUS_VARIANT } from "./OcCheckList";

const qtyFormat = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 3 });
const priceFormat = new Intl.NumberFormat("pl-PL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});
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
      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-700">{line.symbol || "—"}</td>
      <td className="px-3 py-2 text-slate-700">{line.name || "—"}</td>
      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-900">
        {qty(line.qtyOrdered, line.unitOrdered)} → {qty(line.qtyConfirmed, line.unitConfirmed)}
        {ordered || confirmed ? (
          <span className="block text-xs text-slate-500">
            {ordered ?? "—"} → {confirmed ?? "—"}
          </span>
        ) : null}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-slate-600">{OC_LINE_KIND_LABELS[line.kind]}</td>
      <td className="px-3 py-2 text-slate-600">
        {line.note}
        {line.deliveryDate ? <span className="block text-xs text-slate-500">termin {line.deliveryDate}</span> : null}
      </td>
    </tr>
  );
}

/** Jedna sprawa kontroli OC: co się nie zgadza, jaki ruch, decyzja „Wyjaśnione” i wątek w Gmailu. */
export function OcCheckDetail({ check, backHref }: { check: OcCheck; backHref: string }) {
  const threadUrl = gmailThreadUrl(check.mailbox, check.gmailThreadId);
  const differences = check.lines.filter((l) => l.kind !== "ok");
  const okCount = check.lines.length - differences.length;
  const title = [check.supplierName, check.ocNumber ? `OC ${check.ocNumber}` : null].filter(Boolean).join(" · ");

  return (
    <article className="flex min-h-0 flex-col">
      <DetailHeader
        title={title}
        back={{ href: backHref }}
        subtitle={[
          check.zdNumber ? `ZD ${check.zdNumber}` : "ZD nieprzypisane",
          check.linesTotal !== null ? `${check.linesOk} z ${check.linesTotal} pozycji zgodnych` : null,
          check.ocReceivedAt ? `otrzymano ${dateTimeFormat.format(new Date(check.ocReceivedAt))}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            {threadUrl ? (
              <a href={threadUrl} target="_blank" rel="noopener noreferrer" className={detailLinkClass}>
                Wątek w Gmailu
              </a>
            ) : null}
            <OcCheckResolveButton id={check.id} resolved={Boolean(check.resolvedAt)} />
          </>
        }
      >
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge variant={OC_STATUS_VARIANT[check.status]}>{OC_STATUS_LABELS[check.status]}</Badge>
          {check.priority === 2 && !check.resolvedAt ? <Badge variant="danger">Pilne</Badge> : null}
        </div>
      </DetailHeader>

      <div className="space-y-4 px-4 py-4 sm:px-5">
        {check.summary ? <p className="text-sm leading-relaxed text-slate-700">{check.summary}</p> : null}
        {check.nextStep && !check.resolvedAt ? (
          <p className="rounded-md bg-indigo-50 px-3.5 py-2.5 text-sm leading-relaxed text-slate-900">
            <span className="font-semibold">Ruch:</span> {check.nextStep}
          </p>
        ) : null}
        {check.resolvedAt ? (
          <p className="text-sm text-slate-600">
            {[`Wyjaśnione ${dateTimeFormat.format(new Date(check.resolvedAt))}`, check.resolvedByName, check.resolutionNote || null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}

        {differences.length > 0 ? (
          <section aria-labelledby={`oc-lines-${check.id}`} className="space-y-2">
            <h4 id={`oc-lines-${check.id}`} className="text-sm font-semibold text-slate-900">
              Różnice w pozycjach ({differences.length})
            </h4>
            <div className="overflow-x-auto rounded-md border border-slate-200">
              <table className="w-full min-w-[30rem] text-sm">
                <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Symbol</th>
                    <th className="px-3 py-2">Nazwa</th>
                    <th className="px-3 py-2">Zamówiono → OC</th>
                    <th className="px-3 py-2">Rodzaj</th>
                    <th className="px-3 py-2">Uwaga</th>
                  </tr>
                </thead>
                <tbody>
                  {differences.map((line) => (
                    <LineRow key={line.position} line={line} />
                  ))}
                </tbody>
              </table>
            </div>
            {okCount > 0 ? (
              <p className="text-xs text-slate-500">
                Pozostałe {okCount} {okCount === 1 ? "pozycja jest zgodna" : okCount < 5 ? "pozycje są zgodne" : "pozycji jest zgodnych"} z
                ZD.
              </p>
            ) : null}
          </section>
        ) : check.lines.length > 0 ? (
          <p className="text-sm text-slate-600">Wszystkie pozycje zgodne z ZD.</p>
        ) : null}
      </div>
    </article>
  );
}
