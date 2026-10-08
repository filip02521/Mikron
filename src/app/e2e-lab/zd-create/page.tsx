import { notFound } from "next/navigation";
import { isE2ELabEnabled } from "../lab-enabled";
import { ZdCreateDialogLab } from "./ZdCreateDialogLab";

export const dynamic = "force-dynamic";

/** Podgląd okna „Utwórz ZD” na danych przykładowych — bez Kreatora i bez Subiekta. */
export default async function ZdCreateDialogLabPage({
  searchParams,
}: {
  searchParams: Promise<{ dostawca?: string; dok?: string; nazwa?: string }>;
}) {
  if (!isE2ELabEnabled()) notFound();
  const { dostawca, dok, nazwa } = await searchParams;
  const dokId = Math.trunc(Number(dok));
  return (
    <ZdCreateDialogLab
      supplierId={dostawca?.trim() || "00000000-0000-4000-8000-00000000lab0"}
      real={dokId > 0 && nazwa?.trim() ? { dokId, supplierName: nazwa.trim() } : undefined}
    />
  );
}
