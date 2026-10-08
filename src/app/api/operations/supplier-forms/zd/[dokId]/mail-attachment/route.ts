import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessOperations } from "@/lib/auth-roles";
import { loadSupplierZd } from "@/lib/supplier-forms/prepare";
import { buildZdMailAttachment } from "@/lib/supplier-forms/zd-mail-attachment";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";

/** Podgląd załącznika maila ZD — ten sam plik, który wyjdzie do dostawcy (otwiera się w karcie). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ dokId: string }> }) {
  const user = await getSessionUser();
  if (!user || !canAccessOperations(user.role, user.assignedWorkspaces)) {
    return NextResponse.json({ error: "Brak dostępu" }, { status: 401 });
  }
  const dokId = Math.trunc(Number((await params).dokId));
  const supplierId = request.nextUrl.searchParams.get("supplierId") ?? "";
  if (!(dokId > 0) || !supplierId) {
    return NextResponse.json({ error: "Brak dokumentu lub dostawcy" }, { status: 400 });
  }
  try {
    const zd = await loadSupplierZd({ dokId, supplierId });
    if (!zd.ok) return NextResponse.json({ error: zd.message }, { status: 422 });
    // fresh=1 — „Odśwież dokument z Subiekta” po ręcznej zmianie ZD (bez pamięci wydruku).
    const file = await buildZdMailAttachment(zd, dokId, { fresh: request.nextUrl.searchParams.get("fresh") === "1" });
    return new NextResponse(new Uint8Array(file.content), {
      headers: {
        "Content-Type": file.contentType,
        // PDF otwiera się w przeglądarce; Excel/inne pobiera.
        "Content-Disposition": `${file.contentType === "application/pdf" ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
        "Content-Length": String(file.content.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: userFacingErrorText(e, "Nie udało się przygotować załącznika.") }, { status: 500 });
  }
}
