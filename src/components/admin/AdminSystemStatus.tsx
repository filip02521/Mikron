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
  return (
    <Card padding={false} className="overflow-hidden">
      <CardHeader
        inset
        density="compact"
        title="Stan systemu"
        description="Szybki przegląd połączenia z bazą i spójności danych."
        action={
          <Badge variant={isHealthy ? "success" : "warning"}>
            {isHealthy ? "Działa" : "Wymaga uwagi"}
          </Badge>
        }
      />
      <div className="px-3 pb-4 sm:px-4 lg:px-5">
        <Alert tone={isHealthy ? "success" : "warning"}>
          <span className="font-medium">
            {isHealthy
              ? "System gotowy do pracy — panel dzienny i cron mogą działać normalnie."
              : "Sprawdź poniższe problemy przed ręcznym przeliczaniem lub wysyłką maili."}
          </span>
          {issues.length > 0 ? (
            <ul className="mt-2 list-inside list-disc text-sm opacity-90">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : null}
        </Alert>
      </div>
    </Card>
  );
}
