import { notFound } from "next/navigation";
import { actionGetTransactionalEmailDetail } from "@/app/actions/admin-transactional-email";
import { TransactionalEmailDetailClient } from "@/components/admin/TransactionalEmailDetailClient";
import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("adminWysylki");

export default async function AdminWysylkiDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await actionGetTransactionalEmailDetail(id);
  if (!result.ok) notFound();

  return <TransactionalEmailDetailClient log={result.log} />;
}
