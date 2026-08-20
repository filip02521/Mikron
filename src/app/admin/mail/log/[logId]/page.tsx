import { notFound } from "next/navigation";
import { actionGetMailLogDetail } from "@/app/actions/admin-mail";
import { MailLogDetailClient } from "@/components/admin/MailLogDetailClient";
import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("adminMail");

export default async function AdminMailLogPage({
  params,
}: {
  params: Promise<{ logId: string }>;
}) {
  const { logId } = await params;
  const result = await actionGetMailLogDetail(logId);
  if (!result.ok) notFound();

  return <MailLogDetailClient log={result.log} issues={result.issues} />;
}
