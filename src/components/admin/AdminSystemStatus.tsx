import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { PanelSummaryMetric } from "@/components/ui/PanelSummaryMetric";
import { cn } from "@/lib/cn";
import { panelTypography } from "@/lib/ui/ontime-theme";

export function AdminSystemStatus({
  isHealthy,
  issues,
}: {
  isHealthy: boolean;
  issues: string[];
}) {
  const dbIssue = issues.some((issue) => /baza|supabase|Błąd /i.test(issue));

  return (
    <Card padding={false} className="overflow-hidden">
      <CardHeader
        inset
        density="compact"
        title="Stan systemu"
        description="Połączenie z bazą, zmienne środowiska i gotowość panelu dziennego."
        action={
          <Badge variant={isHealthy ? "success" : "warning"}>
            {isHealthy ? "Działa" : "Wymaga uwagi"}
          </Badge>
        }
      />
      <div className="space-y-4 px-3 pb-4 sm:px-4 lg:px-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <PanelSummaryMetric
            label="Status ogólny"
            value={isHealthy ? "Gotowy" : "Sprawdź"}
            hint="Panel dzienny i zadania w tle"
            tone={isHealthy ? "success" : "warning"}
          />
          <PanelSummaryMetric
            label="Wykryte problemy"
            value={issues.length}
            hint={issues.length ? "Szczegóły poniżej" : "Brak alertów"}
            tone={issues.length === 0 ? "success" : issues.length > 2 ? "danger" : "warning"}
          />
          <PanelSummaryMetric
            label="Baza danych"
            value={dbIssue ? "Błąd" : "Połączono"}
            hint="Supabase — tabele operacyjne"
            tone={dbIssue ? "danger" : isHealthy ? "success" : "default"}
          />
        </div>

        <div
          className={cn(
            "rounded-md border px-3 py-2.5 text-sm",
            isHealthy
              ? "border-emerald-200/80 bg-emerald-50/40 text-emerald-900"
              : "border-amber-200/80 bg-amber-50/40 text-amber-950"
          )}
        >
          <p className="font-medium">
            {isHealthy
              ? "System gotowy do pracy — panel dzienny i cron mogą działać normalnie."
              : "Sprawdź poniższe problemy przed ręcznym przeliczaniem lub wysyłką maili."}
          </p>
          {issues.length > 0 ? (
            <ul className={cn(panelTypography.caption, "mt-2 list-inside list-disc space-y-0.5")}>
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
