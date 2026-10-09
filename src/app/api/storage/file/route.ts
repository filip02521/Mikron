import { NextResponse, type NextRequest } from "next/server";
import { readStorageObject, verifyStorageToken } from "@/lib/storage/local";
import { validateSession } from "@/lib/auth-local/session";
import { COOKIE_NAME } from "@/lib/auth-local/cookies";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ error: "Brak tokenu." }, { status: 400 });
  }
  const parsed = verifyStorageToken(token);
  if (!parsed) {
    return NextResponse.json({ error: "Token wygasł lub jest nieprawidłowy." }, { status: 403 });
  }

  const raw = request.cookies.get(COOKIE_NAME)?.value;
  const session = raw ? await validateSession(raw) : null;
  if (!session) {
    return NextResponse.json({ error: "Brak sesji." }, { status: 401 });
  }

  try {
    const bytes = await readStorageObject(parsed.dbPath);
    const ext = parsed.dbPath.split(".").pop()?.toLowerCase();
    const type =
      ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : ext === "pdf"
            ? "application/pdf"
            : ext === "jpg" || ext === "jpeg"
              ? "image/jpeg"
              : ext === "docx"
                ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                : ext === "xlsx"
                  ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  : ext === "xls"
                    ? "application/vnd.ms-excel"
                    : ext === "doc"
                      ? "application/msword"
                      : ext === "txt"
                        ? "text/plain"
                        : ext === "csv"
                          ? "text/csv"
                          : "application/octet-stream";
    // Pliki bywają od zewnętrznych nadawców (np. dostawców) — przeglądarka nie zgaduje typu,
    // a w karcie otwierają się tylko zdjęcia i PDF; reszta jako pobranie.
    const inline = type.startsWith("image/") || type === "application/pdf";
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
        ...(inline ? {} : { "Content-Disposition": "attachment" }),
      },
    });
  } catch {
    return NextResponse.json({ error: "Nie znaleziono pliku." }, { status: 404 });
  }
}
