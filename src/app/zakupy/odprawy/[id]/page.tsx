import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOperations } from "@/lib/auth";
import { actionGetCustomsClearance } from "@/app/actions/customs-clearance";
import { CustomsClearanceEditor } from "@/components/zakupy/customs/CustomsClearanceEditor";
import { isCustomsAiConfigured } from "@/lib/customs/customs-ai";
import { pageMetadataFor } from "@/lib/ui/page-metadata";
import { adminPageShellClass } from "@/lib/ui/ontime-theme";

export const metadata: Metadata = pageMetadataFor("customsClearance");
export const dynamic = "force-dynamic";
/** Odczyt faktur / deklaracji przez AI (Gemini) trwa do kilku minut. */
export const maxDuration = 300;

export default async function CustomsClearancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOperations("read");
  const { id } = await params;
  const view = await actionGetCustomsClearance(id);
  if (!view) notFound();

  return (
    <div className={adminPageShellClass}>
      <CustomsClearanceEditor view={view} aiEnabled={isCustomsAiConfigured()} />
    </div>
  );
}
