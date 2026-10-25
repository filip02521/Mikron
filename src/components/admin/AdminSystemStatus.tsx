import { AdminMetrics } from "@/components/admin/AdminMetrics";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";

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
      <div className="space-y-4 px-3 py-4 sm:px-4 lg:px-5">
        <AdminMetrics
          items={[
            {
              label: "Status ogólny",
              value: isHealthy ? "Gotowy" : "Sprawdź",
              hint: "Panel dzienny i zadania w tle",
              tone: isHealthy ? "success" : "warning",
            },
            {
              label: "Wykryte problemy",
              value: issues.length,
              hint: issues.length ? "Szczegóły poniżej" : "Brak alertów",
              tone: issues.length === 0 ? "success" : issues.length > 2 ? "danger" : "warning",
            },
            {
              label: "Baza danych",
              value: dbIssue ? "Błąd" : "Połączono",
              hint: "PostgreSQL - tabele operacyjne",
              tone: dbIssue ? "danger" : "default",
            },
          ]}
        />

        {isHealthy && issues.length === 0 ? (
          <p className="text-sm text-slate-600">
            System gotowy do pracy - panel dzienny i cron mogą działać normalnie.
          </p>
        ) : (
          <Alert
            tone={isHealthy ? "info" : "warning"}
            title={
              isHealthy
                ? "System działa, ale są uwagi"
                : "Sprawdź poniższe problemy przed ręcznym przeliczaniem lub wysyłką maili."
            }
          >
            {issues.length > 0 ? (
              <ul className="list-inside list-disc space-y-0.5">
                {issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            ) : null}
          </Alert>
        )}
      </div>
    </Card>
  );
}
