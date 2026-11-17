import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { isSalesAccount } from "@/lib/auth-roles";
import { resolveSubiektZkConfig } from "@/lib/subiekt/config";
import { pageMetadataFor } from "@/lib/ui/page-metadata";
import { ZkFromMailClient } from "@/components/sales/ZkFromMailClient";

export const metadata: Metadata = pageMetadataFor("zkZMaila");
export const dynamic = "force-dynamic";

export default async function ZkZMailaPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/zk/z-maila");
  // Jak proxy dla /zk/*: handlowiec i kierownik sprzedaży.
  if (!isSalesAccount(user.role)) redirect("/");

  const host = resolveSubiektZkConfig();
  return <ZkFromMailClient hostError={host.ok ? null : host.message} />;
}
