import { TeethPanelRoute } from "@/components/zeby/TeethPanelRoute";
import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("zeby");

export const dynamic = "force-dynamic";

export default function ZebyKolejkaPage() {
  return <TeethPanelRoute tab="kolejka" />;
}
