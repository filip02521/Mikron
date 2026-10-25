import { notFound } from "next/navigation";
import { actionGetMailJob } from "@/app/actions/admin-mail";
import { MailJobAdminClient } from "@/components/admin/MailJobAdminClient";
import { requireMailCenterAccess } from "@/lib/auth/admin-modules";
import { fetchRaportyRunnerStatus } from "@/lib/services/mail/raporty-runner-status";
import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("adminMail");

export default async function AdminMailJobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  await requireMailCenterAccess();
  const { jobId } = await params;
  const [result, runnerStatus] = await Promise.all([
    actionGetMailJob(jobId),
    fetchRaportyRunnerStatus(),
  ]);
  if (!result.ok) notFound();

  return (
    <MailJobAdminClient
      job={result.job}
      recipients={result.recipients}
      logs={result.logs}
      runnerStatus={runnerStatus}
    />
  );
}
