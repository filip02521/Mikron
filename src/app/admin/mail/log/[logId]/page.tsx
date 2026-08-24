import { notFound } from "next/navigation";
import { actionGetMailLogDetail } from "@/app/actions/admin-mail";
import { MailLogDetailClient } from "@/components/admin/MailLogDetailClient";
import { requireMailCenterAccess } from "@/lib/auth/admin-modules";
import { isAdmin } from "@/lib/auth-roles";
import { resolveAdminHubTabs } from "@/lib/admin-hub";
import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("adminMail");

export default async function AdminMailLogPage({
  params,
}: {
  params: Promise<{ logId: string }>;
}) {
  const user = await requireMailCenterAccess();
  const visibleTabs = resolveAdminHubTabs(isAdmin(user.role));
  const { logId } = await params;
  const result = await actionGetMailLogDetail(logId);
  if (!result.ok) notFound();

  return (
    <MailLogDetailClient
      log={result.log}
      issues={result.issues}
      visibleTabs={visibleTabs}
    />
  );
}
