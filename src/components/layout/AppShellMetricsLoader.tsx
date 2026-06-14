import { fetchAppShellMetrics, type AppShellMetricsInput } from "@/lib/layout/app-shell-metrics";
import { AppShellMetricsSync } from "@/components/layout/AppShellMetricsContext";

export async function AppShellMetricsLoader({
  input,
}: {
  input: AppShellMetricsInput;
}) {
  const metrics = await fetchAppShellMetrics(input);
  return <AppShellMetricsSync payload={metrics} />;
}
