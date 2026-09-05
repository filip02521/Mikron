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
            : "image/jpeg";
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "Nie znaleziono pliku." }, { status: 404 });
  }
}
