import { fetchIndividualHistory, fetchNormalHistory } from "@/lib/data/queries";
import { HistoriaClient } from "@/components/history/HistoriaClient";
import { getAppRole } from "@/lib/auth-dev";
import { logDevPageError } from "@/lib/dev/log-page-error";
import { canAccessOperations, isAdmin } from "@/lib/auth-roles";
import { Alert } from "@/components/ui/Alert";
import { procurementArchivePageShellClass } from "@/lib/ui/ontime-theme";
import type { IndividualOrder } from "@/types/database";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("historia");

export default async function HistoriaPage() {
  const role = await getAppRole();
  const canManageHistory = role ? isAdmin(role) : false;
  const canOperateOrders = role ? canAccessOperations(role) : false;
  let individual: IndividualOrder[] = [];
  let normal: Awaited<ReturnType<typeof fetchNormalHistory>> = [];
  let loadError: string | null = null;
  try {
    [individual, normal] = await Promise.all([
      fetchIndividualHistory(),
      fetchNormalHistory(),
    ]);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Nie udało się załadować historii.";
    logDevPageError("historia/page", error);
  }

  return (
    <div className={procurementArchivePageShellClass}>
      {loadError ? (
        <Alert tone="warning" className="mb-4">
          {loadError}. Sprawdź połączenie z Supabase.
        </Alert>
      ) : null}
      <HistoriaClient
      individual={individual}
      normal={normal}
      canManageHistory={canManageHistory}
      canOperateOrders={canOperateOrders}
    />
    </div>
  );
}
