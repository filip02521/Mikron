import { redirect } from "next/navigation";
import { needsBootstrapSetup } from "@/lib/setup/bootstrap";
import { fetchLoginDirectoryAccounts } from "@/lib/auth/login-directory";
import { toPublicLoginDirectoryAccounts } from "@/lib/auth/login-directory-public";
import { LoginPageClient } from "./LoginPageClient";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("login");

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await needsBootstrapSetup()) redirect("/setup");

  const accounts = toPublicLoginDirectoryAccounts(await fetchLoginDirectoryAccounts());

  return <LoginPageClient accounts={accounts} />;
}
