import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { analyzeTeethImageForLines } from "@/lib/teeth/teeth-vision-detect";
import { TEETH_LINE_BY_ID } from "@/lib/teeth/teeth-lines-data";

export const maxDuration = 120;

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

type RateBucket = { count: number; resetAt: number };
const rateLimitMap = new Map<string, RateBucket>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 5 * 60_000;

let lastCleanupAt = 0;
function cleanupRateLimitMap() {
  const now = Date.now();
  if (now - lastCleanupAt < RATE_LIMIT_CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;
  for (const [key, bucket] of rateLimitMap) {
    if (now >= bucket.resetAt) rateLimitMap.delete(key);
  }
}

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  cleanupRateLimitMap();
  const bucket = rateLimitMap.get(userId);
  if (!bucket || now >= bucket.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_MAX) return false;
  bucket.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Wymagane logowanie" }, { status: 401 });
  }

  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { ok: false, error: "Zbyt wiele zapytań. Spróbuj ponownie za chwilę." },
      { status: 429 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Nieprawidłowe dane formularza." },
      { status: 400 },
    );
  }

  const imageFile = formData.get("image");

  if (!(imageFile instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "Brak pliku obrazu." },
      { status: 400 },
    );
  }

  if (!ALLOWED_MIME_TYPES.includes(imageFile.type)) {
    return NextResponse.json(
      { ok: false, error: "Nieobsługiwany format pliku. Użyj JPG, PNG lub WebP." },
      { status: 400 },
    );
  }

  if (imageFile.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Plik jest za duży. Maksymalny rozmiar to 10 MB." },
      { status: 400 },
    );
  }

  const arrayBuffer = await imageFile.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  console.debug(`[teeth-vision-detect] Request from user ${user.id}, image: ${imageFile.size} bytes`);

  const result = await analyzeTeethImageForLines(base64, imageFile.type);

  if (!result.ok) {
    console.warn(`[teeth-vision-detect] Result: error — ${result.error}`);
    return NextResponse.json(result, { status: 422 });
  }

  const linesWithLabels = result.lines.map((l) => {
    const def = TEETH_LINE_BY_ID.get(l.productLine);
    return {
      productLine: l.productLine,
      label: def?.label ?? l.productLine,
      confidence: l.confidence,
      note: l.note,
    };
  });

  console.debug(`[teeth-vision-detect] Result: ok — ${linesWithLabels.length} lines detected`);

  return NextResponse.json({
    ok: true,
    lines: linesWithLabels,
  });
}
