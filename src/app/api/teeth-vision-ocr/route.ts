import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isTeethProductLine, type TeethCatalogRef } from "@/lib/teeth/teeth-catalog";
import { analyzeTeethImage } from "@/lib/teeth/teeth-vision-ocr";
import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import { randomUUID } from "crypto";

export const maxDuration = 260;

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
  const productLineRaw = formData.get("productLine");

  if (!(imageFile instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "Brak pliku obrazu." },
      { status: 400 },
    );
  }

  let catalog: TeethCatalogRef | undefined;
  if (typeof productLineRaw === "string" && productLineRaw.length > 0) {
    if (!isTeethProductLine(productLineRaw)) {
      return NextResponse.json(
        { ok: false, error: "Nieprawidłowa linia produktu." },
        { status: 400 },
      );
    }
    catalog = { productLine: productLineRaw };
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

  console.log(`[teeth-vision-ocr] Request from user ${user.id}, image: ${imageFile.size} bytes, productLine: ${catalog?.productLine ?? "auto"}`);

  const result = await analyzeTeethImage(base64, imageFile.type, catalog);

  if (!result.ok) {
    console.log(`[teeth-vision-ocr] Result: error — ${result.error}`);
    return NextResponse.json(result, { status: 422 });
  }

  let imagePath: string | null = null;
  if (hasSupabaseConfig()) {
    try {
      const supabase = createAdminClient();
      const ext = imageFile.type === "image/png" ? "png" : imageFile.type === "image/webp" ? "webp" : "jpg";
      const fileName = `${randomUUID()}.${ext}`;
      imagePath = `teeth-ocr/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("teeth-ocr-images")
        .upload(imagePath, arrayBuffer, {
          contentType: imageFile.type,
          upsert: false,
        });

      if (uploadError) {
        console.error("[teeth-vision-ocr] Storage upload error:", uploadError.message);
        imagePath = null;
      }
    } catch (e) {
      console.error("[teeth-vision-ocr] Storage upload failed:", e);
      imagePath = null;
    }
  }

  console.log(`[teeth-vision-ocr] Result: ok — ${result.groups.length} groups, lines: ${result.detectedProductLines.join(", ")}, image: ${imagePath ?? "not uploaded"}`);
  return NextResponse.json({
    ok: true,
    groups: result.groups,
    detectedProductLines: result.detectedProductLines,
    imagePath,
  });
}
