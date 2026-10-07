import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessOperations } from "@/lib/auth-roles";
import { cleanUuid, loadClearanceView } from "@/lib/customs/customs-data";
import { collectCustomsMailAttachments } from "@/lib/customs/customs-mail-attachments";
import { createAdminClient } from "@/lib/supabase/admin";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";

/** Podgląd załącznika maila do agencji (`i` = pozycja na liście) — ten sam plik, który pójdzie w mailu. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user || !canAccessOperations(user.role, user.assignedWorkspaces)) {
    return NextResponse.json({ error: "Brak dostępu" }, { status: 401 });
  }
  const id = cleanUuid((await params).id);
  const index = Math.trunc(Number(request.nextUrl.searchParams.get("i")));
  const includeExcel = request.nextUrl.searchParams.get("excel") === "1";
  if (!id || !(index >= 0)) return NextResponse.json({ error: "Brak odprawy lub pliku" }, { status: 400 });
  try {
    const supabase = createAdminClient();
    const view = await loadClearanceView(supabase, id);
    if (!view) return NextResponse.json({ error: "Odprawa nie istnieje" }, { status: 404 });
    const file = (await collectCustomsMailAttachments(supabase, view, includeExcel))[index];
    if (!file) return NextResponse.json({ error: "Nie ma takiego załącznika" }, { status: 404 });
    const inline = /^(application\/pdf|image\/)/.test(file.contentType);
    return new NextResponse(new Uint8Array(file.content), {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
        "Content-Length": String(file.content.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: userFacingErrorText(e, "Nie udało się przygotować załącznika.") }, { status: 500 });
  }
}
