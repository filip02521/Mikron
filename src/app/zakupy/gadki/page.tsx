import type { Metadata } from "next";
import { requireOperations } from "@/lib/auth";
import {
  ensureGadkiSite,
  fetchGadkiPageData,
} from "@/lib/data/external-warehouse-gadki";
import { syncExternalWarehouseZkLinks } from "@/lib/external-warehouse/sync";
import { formatSyncDiffBanner } from "@/lib/external-warehouse/copy";
import {
  getSubiektAvailability,
  isSubiektAvailableForZdSync,
} from "@/lib/subiekt/availability";
import { pageMetadataFor } from "@/lib/ui/page-metadata";
import { MagazynGadkiClient } from "@/components/zakupy/MagazynGadkiClient";
import { Alert } from "@/components/ui/Alert";
import { panelPageShellClass } from "@/lib/ui/ontime-theme";
import { ADMIN_PANEL_PREVIEW_MUTATION_BLOCKED } from "@/lib/auth/admin-panel-preview-messages";

export const metadata: Metadata = pageMetadataFor("magazynGadki");
export const dynamic = "force-dynamic";

/** Budżet SSR na sync multi-ZK — po przekroczeniu pokazujemy stale + banner. */
const PAGE_SYNC_BUDGET_MS = 20_000;

async function canMutateOperations(): Promise<boolean> {
  try {
    await requireOperations("mutate");
    return true;
  } catch (e) {
    if (e instanceof Error && e.message === ADMIN_PANEL_PREVIEW_MUTATION_BLOCKED) {
      return false;
    }
    // Brak uprawnień mutate poza preview — nie syncujemy zapisów.
    return false;
  }
}

export default async function MagazynGadkiPage() {
  const user = await requireOperations("read");
  const canMutate = await canMutateOperations();

  let loadError: string | null = null;
  let pageData: Awaited<ReturnType<typeof fetchGadkiPageData>> | null = null;
  let syncBanner: {
    changes: { zkNumber: string; text: string }[];
    errors: { zkNumber: string; message: string }[];
    locked?: boolean;
    readOnly?: boolean;
  } | null = null;

  let subiektLabel = "System magazynowy";
  let subiektMessage = "";
  let subiektReachable = false;

  try {
    const availability = await getSubiektAvailability();
    subiektLabel = availability.shortLabel;
    subiektMessage = availability.message;
    subiektReachable = isSubiektAvailableForZdSync(availability);

    const site = await ensureGadkiSite();
    pageData = await fetchGadkiPageData(site.id);
    pageData = { ...pageData, site: { id: site.id, slug: site.slug, name: site.name } };

    if (canMutate && pageData.syncLinks.length > 0) {
      try {
        const results = await Promise.race([
          syncExternalWarehouseZkLinks(pageData.syncLinks, {
            force: false,
            actorUserId: user.id,
          }),
          new Promise<never>((_, reject) => {
            setTimeout(
              () => reject(new Error("SYNC_BUDGET_EXCEEDED")),
              PAGE_SYNC_BUDGET_MS
            );
          }),
        ]);
        const banner = formatSyncDiffBanner(
          results.map((r) => ({
            zkNumber: r.zkNumber,
            diff: r.diff,
            error:
              r.status === "error" || r.status === "unavailable"
                ? r.error ?? r.status
                : null,
          }))
        );
        const locked = results.some((r) => r.status === "locked");
        if (banner.changes.length || banner.errors.length || locked) {
          syncBanner = { ...banner, locked };
        }
        pageData = await fetchGadkiPageData(site.id);
        pageData = {
          ...pageData,
          site: { id: site.id, slug: site.slug, name: site.name },
        };
      } catch (e) {
        if (e instanceof Error && e.message === "SYNC_BUDGET_EXCEEDED") {
          syncBanner = {
            changes: [],
            errors: [
              {
                zkNumber: "Subiekt",
                message:
                  "Synchronizacja przekroczyła limit czasu — pokazano ostatni zapisany snapshot.",
              },
            ],
            locked: true,
          };
        } else {
          throw e;
        }
      }
    } else if (!canMutate) {
      syncBanner = {
        changes: [],
        errors: [],
        readOnly: true,
      };
    }
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Nie udało się wczytać magazynu Gądki.";
  }

  const uiLinks = pageData?.links ?? [];
  const uiNotes = pageData?.notes ?? [];
  const uiLog = pageData?.changeLog ?? [];
  const siteName = pageData?.site.name ?? "Magazyn Gądki";

  return (
    <div className={panelPageShellClass}>
      {loadError ? <Alert tone="error">{loadError}</Alert> : null}
      <MagazynGadkiClient
        siteName={siteName}
        links={uiLinks}
        notes={uiNotes}
        changeLog={uiLog}
        subiektLabel={subiektLabel}
        subiektMessage={subiektMessage}
        subiektReachable={subiektReachable}
        canMutate={canMutate}
        syncBanner={syncBanner}
      />
    </div>
  );
}
