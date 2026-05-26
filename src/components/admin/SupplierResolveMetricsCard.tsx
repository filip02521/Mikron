import { fetchSupplierResolveMetrics } from "@/lib/data/supplier-resolve-metrics";
import { Card, CardHeader } from "@/components/ui/Card";

export async function SupplierResolveMetricsCard() {
  let metrics: Awaited<ReturnType<typeof fetchSupplierResolveMetrics>>;
  try {
    metrics = await fetchSupplierResolveMetrics(7);
  } catch {
    return null;
  }

  if (metrics.total === 0) {
    return (
      <Card className="mb-8">
        <CardHeader
          title="Dopasowanie dostawcy (Subiekt)"
          description="Ostatnie 7 dni — brak wpisów w logu (prośby jeszcze nie korzystały z dopasowania w tle lub migracja 030)."
        />
      </Card>
    );
  }

  return (
    <Card className="mb-8">
      <CardHeader
        title="Dopasowanie dostawcy (Subiekt)"
        description={`Ostatnie ${metrics.sinceDays} dni — wyniki dopasowania w tle po wysłaniu prośby handlowca.`}
      />
      <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6 text-sm">
        <div>
          <dt className="text-slate-500">Łącznie</dt>
          <dd className="text-lg font-semibold tabular-nums">{metrics.total}</dd>
        </div>
        <div>
          <dt className="text-slate-500">→ Nowe</dt>
          <dd className="text-lg font-semibold text-emerald-700 tabular-nums">
            {metrics.promoted}{" "}
            <span className="text-sm font-normal text-slate-500">({metrics.promotedPct}%)</span>
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Brak ZD</dt>
          <dd className="text-lg font-semibold tabular-nums">{metrics.notFound}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Pominięte</dt>
          <dd className="text-lg font-semibold tabular-nums">{metrics.skipped}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Subiekt offline</dt>
          <dd className="text-lg font-semibold tabular-nums">{metrics.offline}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Błąd / inne</dt>
          <dd className="text-lg font-semibold tabular-nums">{metrics.failed}</dd>
        </div>
      </dl>
    </Card>
  );
}
