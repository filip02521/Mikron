import { actionListMailJobs, actionListMailLogs } from "@/app/actions/admin-mail";
import { MailCenterClient } from "@/components/admin/MailCenterClient";
import { requireMailCenterAccess } from "@/lib/auth/admin-modules";
import { isAdmin } from "@/lib/auth-roles";
import { resolveAdminHubTabs } from "@/lib/admin-hub";
import { fetchRaportyRunnerStatus } from "@/lib/services/mail/raporty-runner-status";
import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("adminMail");

export default async function AdminMailPage() {
  const user = await requireMailCenterAccess();
  const visibleTabs = resolveAdminHubTabs(isAdmin(user.role));
  const [jobs, recentLogs, runnerStatus] = await Promise.all([
    actionListMailJobs(),
    actionListMailLogs({ limit: 15 }),
    fetchRaportyRunnerStatus(),
  ]);

  return (
    <MailCenterClient
      jobs={jobs}
      recentLogs={recentLogs}
      runnerStatus={runnerStatus}
      visibleTabs={visibleTabs}
    />
  );
}
