import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessOperations } from "@/lib/auth-roles";
import { buildRolBatchFiles, zipRolBatchFiles } from "@/lib/rol/files";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function download(name: string, contentType: string, content: Buffer) {
  return new NextResponse(new Uint8Array(content), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Content-Length": String(content.length),
      "Cache-Control": "no-store",
    },
  });
}

/** Pliki zgłoszenia ROL jednego klienta: `?plik=arkusz` — sam arkusz, domyślnie ZIP z arkuszem i PDF-ami FS. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Zaloguj się ponownie" }, { status: 401 });
  // Jak strona Asystenta (requireOperations + rola): dostęp do operacji i tylko admin albo zakupy.
  if (!canAccessOperations(user.role, user.assignedWorkspaces) || (user.role !== "admin" && user.role !== "zakupy")) {
    return NextResponse.json({ error: "Brak dostępu" }, { status: 403 });
  }
  const batchId = (await params).batchId;
  if (!UUID_RE.test(batchId)) return NextResponse.json({ error: "Nieprawidłowe zgłoszenie" }, { status: 400 });
  try {
    const files = await buildRolBatchFiles(batchId);
    if (!files) return NextResponse.json({ error: "Nie znaleziono zgłoszenia — odśwież stronę." }, { status: 404 });
    if (request.nextUrl.searchParams.get("plik") === "arkusz") {
      return download(files.sheet.name, files.sheet.contentType, files.sheet.content);
    }
    if (files.missingPdf.length) {
      return NextResponse.json(
        { error: `Czekam na PDF: ${files.missingPdf.join(", ")}. Pobierz pliki, gdy będą gotowe.` },
        { status: 409 }
      );
    }
    return download(`${files.label}.zip`, "application/zip", await zipRolBatchFiles(files));
  } catch (e) {
    return NextResponse.json({ error: userFacingErrorText(e, "Nie udało się przygotować plików.") }, { status: 500 });
  }
}
