import { redirect } from "next/navigation";
import { getAppRole } from "@/lib/auth-dev";
import { homePathForRole } from "@/lib/auth-roles";
import { needsBootstrapSetup } from "@/lib/setup/bootstrap";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("home");

export const dynamic = "force-dynamic";

export default async function Home() {
  if (await needsBootstrapSetup()) redirect("/setup");

  const role = await getAppRole();
  if (!role) redirect("/login");
  redirect(homePathForRole(role));
}
