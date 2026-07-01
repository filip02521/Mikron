import { TeethPanelRoute } from "@/components/zeby/TeethPanelRoute";
import { TEETH_TAB_HINTS, TEETH_TAB_PAGE_TITLES } from "@/components/zeby/teeth-panel-copy";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadata(
  TEETH_TAB_PAGE_TITLES.historia,
  TEETH_TAB_HINTS.historia,
);

export const dynamic = "force-dynamic";

export default function ZebyHistoriaPage() {
  return <TeethPanelRoute tab="historia" />;
}
