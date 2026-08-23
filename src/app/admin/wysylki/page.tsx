import {
  actionListTransactionalEmails,
} from "@/app/actions/admin-transactional-email";
import { TransactionalEmailListClient } from "@/components/admin/TransactionalEmailListClient";
import type { TransactionalEmailKind } from "@/types/database";
import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("adminWysylki");

const KINDS = new Set<TransactionalEmailKind>([
  "delivery",
  "informacja",
  "procurement_cancel",
  "request_note_update",
  "board_reply",
  "password_reset_otp",
  "generic",
  "attachments",
]);

export default async function AdminWysylkiPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const kindRaw = sp.kind?.trim();
  const statusRaw = sp.status?.trim();
  const kind =
    kindRaw && KINDS.has(kindRaw as TransactionalEmailKind)
      ? (kindRaw as TransactionalEmailKind)
      : "all";
  const status =
    statusRaw === "sent" || statusRaw === "failed" ? statusRaw : "all";

  let rows: Awaited<ReturnType<typeof actionListTransactionalEmails>>["rows"] =
    [];
  let total = 0;
  let loadError: string | undefined;
  try {
    const result = await actionListTransactionalEmails({
      kind,
      status,
      limit: 80,
    });
    rows = result.rows;
    total = result.total;
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  return (
    <TransactionalEmailListClient
      rows={rows}
      total={total}
      kind={kind}
      status={status}
      loadError={loadError}
    />
  );
}
