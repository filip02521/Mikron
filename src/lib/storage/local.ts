import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

export function storageRoot(): string {
  const root = process.env.STORAGE_ROOT?.trim();
  if (!root) {
    throw new Error("Missing STORAGE_ROOT");
  }
  return root;
}

export function signingSecret(): string {
  const secret = process.env.STORAGE_SIGNING_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("STORAGE_SIGNING_SECRET must be at least 32 characters");
  }
  return secret;
}

/** Prefix w DB → folder pod STORAGE_ROOT */
export function folderForDbPrefix(dbPath: string): string {
  const trimmed = dbPath.replace(/^\/+/, "");
  if (trimmed.startsWith("board/")) {
    return path.join(storageRoot(), "department-board", trimmed.slice("board/".length));
  }
  if (trimmed.startsWith("teeth-ocr/")) {
    return path.join(storageRoot(), "teeth-ocr", trimmed.slice("teeth-ocr/".length));
  }
  if (trimmed.startsWith("teeth-orders/")) {
    return path.join(storageRoot(), "teeth-orders", trimmed.slice("teeth-orders/".length));
  }
  throw new Error(`Unknown storage prefix: ${dbPath}`);
}

function assertSafeRelative(rel: string) {
  if (rel.includes("..") || path.isAbsolute(rel)) {
    throw new Error("Invalid storage path");
  }
}

export async function writeStorageObject(dbPath: string, bytes: Buffer): Promise<void> {
  const abs = folderForDbPrefix(dbPath);
  assertSafeRelative(path.relative(storageRoot(), abs));
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, bytes);
}

export async function readStorageObject(dbPath: string): Promise<Buffer> {
  return readFile(folderForDbPrefix(dbPath));
}

export async function deleteStorageObject(dbPath: string): Promise<void> {
  try {
    await unlink(folderForDbPrefix(dbPath));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;
  }
}

export function signStoragePath(dbPath: string, userId: string, ttlSec = 3600): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = `${dbPath}|${exp}|${userId}`;
  const sig = createHmac("sha256", signingSecret()).update(payload).digest("base64url");
  return Buffer.from(JSON.stringify({ p: dbPath, exp, u: userId, s: sig })).toString(
    "base64url"
  );
}

export function verifyStorageToken(token: string): { dbPath: string; userId: string } | null {
  try {
    const parsed = JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as {
      p: string;
      exp: number;
      u: string;
      s: string;
    };
    if (!parsed?.p || !parsed.s || !parsed.u) return null;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    const payload = `${parsed.p}|${parsed.exp}|${parsed.u}`;
    const expected = createHmac("sha256", signingSecret()).update(payload).digest("base64url");
    const a = Buffer.from(parsed.s);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return { dbPath: parsed.p, userId: parsed.u };
  } catch {
    return null;
  }
}

export async function sha256File(absPath: string): Promise<string> {
  const buf = await readFile(absPath);
  return createHash("sha256").update(buf).digest("hex");
}

export function randomObjectName(ext: string): string {
  return `${randomBytes(16).toString("hex")}${ext.startsWith(".") ? ext : `.${ext}`}`;
}
