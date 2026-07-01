import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";
import type { Tab } from "@/components/zeby/teeth-panel-types";
import { VALID_TEETH_PANEL_TABS } from "@/components/zeby/teeth-panel-types";

export const metadata: Metadata = pageMetadataFor("zeby");

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ tab?: string }>;

export default async function ZebyIndexPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const tab = params.tab;
  if (tab === "harmonogram") {
    redirect("/zakupy/dostawcy?tor=zeby");
  }
  if (tab && VALID_TEETH_PANEL_TABS.includes(tab as Tab)) {
    if (tab === "kolejka") {
      redirect("/zeby/kolejka");
    }
    redirect(`/zeby/${tab}`);
  }
  redirect("/zeby/kolejka");
}
