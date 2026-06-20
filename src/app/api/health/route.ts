import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import { isAppUrlProductionReady, isProductionRuntime, getCronSecret } from "@/lib/env/app-config";
import { isEmailConfigured } from "@/lib/env/email-config";
import { runSchemaChecks } from "@/lib/supabase/schema-check";
import { readCronRun } from "@/lib/services/cron-run-log";
import { authorizeCronRequest } from "@/lib/services/cron-auth";

export const dynamic = "force-dynamic";

function authorizeHealthRequest(request: NextRequest): NextResponse | null {
  if (isProductionRuntime()) {
    return authorizeCronRequest(request.headers.get("authorization"));
  }
  if (getCronSecret()) {
    return authorizeCronRequest(request.headers.get("authorization"));
  }
  return null;
}

export async function GET(request: NextRequest) {
  const denied = authorizeHealthRequest(request);
  if (denied) return denied;

  const checks: Record<string, boolean | string> = {};
  const issues: string[] = [];

  checks.supabase_configured = hasSupabaseConfig();
  if (!checks.supabase_configured) {
    issues.push("Brak konfiguracji Supabase");
  }

  checks.email_configured = isEmailConfigured();
  if (isProductionRuntime() && !checks.email_configured) {
    issues.push("Brak RESEND_API_KEY w produkcji");
  }

  checks.cron_secret = Boolean(getCronSecret());
  if (isProductionRuntime() && !checks.cron_secret) {
    issues.push("Brak CRON_SECRET w produkcji");
  }

  checks.app_url = isAppUrlProductionReady();
  if (isProductionRuntime() && !checks.app_url) {
    issues.push(
      "NEXT_PUBLIC_APP_URL musi być https:// lub wewnętrzna domena HTTP (np. ontime.mikran.pl)"
    );
  }

  if (hasSupabaseConfig()) {
    try {
      const supabase = createAdminClient();
      const { error } = await supabase.from("suppliers").select("id").limit(1);
      checks.database = !error;
      if (error) issues.push(`Baza: ${error.message}`);

      const schema = await runSchemaChecks(supabase);
      checks.schema = schema.ok;
      issues.push(...schema.issues);
    } catch (e) {
      checks.database = false;
      issues.push(e instanceof Error ? e.message : "Błąd połączenia z bazą");
    }
  }

  const deliveries = await readCronRun("process_deliveries");
  const morning = await readCronRun("morning_routine");
  const morningSync = await readCronRun("morning_sync");
  if (deliveries) checks.cron_process_deliveries = deliveries.at;
  if (morning) checks.cron_morning_routine = morning.at;
  if (morningSync) checks.cron_morning_sync = morningSync.at;

  const healthy = issues.length === 0;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      checks,
      issues,
    },
    { status: healthy ? 200 : 503 }
  );
}
