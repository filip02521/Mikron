import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessOperations } from "@/lib/auth-roles";
import { prepareSupplierFormForZd } from "@/lib/supplier-forms/prepare";
import { renderSupplierForm } from "@/lib/supplier-forms/render";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";

/** Formularz zamówienia dostawcy (PDF / Excel) wypełniony pozycjami z ZD. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dokId: string }> }
) {
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
    const prepared = await prepareSupplierFormForZd({ dokId, supplierId });
    if (!prepared.ok) return NextResponse.json({ error: prepared.message }, { status: 422 });
    const { bytes, contentType, extension } = await renderSupplierForm(prepared);
    const fileName = `${prepared.supplierName} ${prepared.dokNr.replace(/[\\/]+/g, "-")}.${extension}`;
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: userFacingErrorText(e, "Nie udało się przygotować formularza.") },
      { status: 500 }
    );
  }
}
