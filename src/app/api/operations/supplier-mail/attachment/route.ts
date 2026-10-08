import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessZdEstimate } from "@/lib/auth-roles";
import { query } from "@/lib/db/pool";
import { fetchGmailAttachment, type GmailAttachmentRef } from "@/lib/google/gmail";
import { mailboxAccessToken } from "@/lib/supplier-mail/mailbox";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";

/**
 * Załącznik maila z Poczty dostawców (`id` = wiersz supplier_mail_messages, `a` = attachmentId).
 * Tylko załączniki wiadomości zapisanych w Poczcie — trasa nie otwiera dowolnych maili ze skrzynki.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !canAccessZdEstimate(user.role, user.assignedWorkspaces)) {
    return NextResponse.json({ error: "Brak dostępu" }, { status: 401 });
  }
  const id = request.nextUrl.searchParams.get("id") ?? "";
  const attachmentId = request.nextUrl.searchParams.get("a") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !attachmentId) {
    return NextResponse.json({ error: "Brak wiadomości lub załącznika" }, { status: 400 });
  }
  try {
    const { rows } = await query<{ mailbox: string; gmail_message_id: string; attachments: GmailAttachmentRef[] }>(
      `SELECT mailbox, gmail_message_id, attachments FROM public.supplier_mail_messages WHERE id = $1`,
      [id]
    );
    const row = rows[0];
    const ref = row?.attachments?.find((a) => a.attachmentId === attachmentId);
    if (!row || !ref) return NextResponse.json({ error: "Nie ma takiego załącznika" }, { status: 404 });
    const token = await mailboxAccessToken(row.mailbox);
    if (!token) return NextResponse.json({ error: "Skrzynka nie jest połączona z OnTime" }, { status: 409 });
    const data = await fetchGmailAttachment(token, row.gmail_message_id, attachmentId);
    if (!data) return NextResponse.json({ error: "Załącznika już nie ma w skrzynce" }, { status: 404 });
    // W karcie tylko PDF i obrazy rastrowe — SVG / HTML od dostawcy mógłby uruchomić skrypt na domenie OnTime.
    const inline = /^(application\/pdf|image\/(png|jpe?g|gif|webp))$/i.test(ref.mimeType);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": inline ? ref.mimeType : "application/octet-stream",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(ref.filename)}`,
        "Content-Length": String(data.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: userFacingErrorText(e, "Nie udało się pobrać załącznika.") }, { status: 500 });
  }
}
