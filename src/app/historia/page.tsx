import { fetchIndividualHistory, fetchNormalHistory } from "@/lib/data/queries";
import { HistoriaClient } from "@/components/history/HistoriaClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAppRole } from "@/lib/auth-dev";
import { isAdmin } from "@/lib/auth-roles";
import type { IndividualOrder } from "@/types/database";

export default async function HistoriaPage() {
  const role = await getAppRole();
  const canManageHistory = role ? isAdmin(role) : false;
  let individual: IndividualOrder[] = [];
  let normal: Awaited<ReturnType<typeof fetchNormalHistory>> = [];
  try {
    [individual, normal] = await Promise.all([
      fetchIndividualHistory(),
      fetchNormalHistory(),
    ]);
  } catch {
    /* empty */
  }

  return (
    <>
      <PageHeader
        title="Historia"
        description="Audyt zamówień dla handlowców (bez pozycji informacyjnych). Na stronie 6 ostatnich wpisów; pełna lista z wyszukiwaniem po „Pokaż pełną historię”. Dane starsze niż 6 miesięcy są usuwane automatycznie."
      />
      <HistoriaClient
        individual={individual}
        normal={normal}
        canManageHistory={canManageHistory}
      />
    </>
  );
}
