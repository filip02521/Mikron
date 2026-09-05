/**
 * Jednorazowa migracja plików z Supabase Storage → STORAGE_ROOT.
 * Wymaga: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + STORAGE_ROOT
 *
 * Usage:
 *   npx tsx scripts/migrate-storage-from-supabase.ts
 *   npx tsx scripts/migrate-storage-from-supabase.ts --manifest data/cutover/storage-objects.json
 */
import { createHash } from "crypto";
import { readFileSync, existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const BUCKETS: { id: string; prefix: string }[] = [
  { id: "teeth-ocr-images", prefix: "teeth-ocr" },
  { id: "teeth-order-files", prefix: "teeth-orders" },
  { id: "department-board-images", prefix: "board" },
];

type StorageEntry = { bucket_id: string; name: string };

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return undefined;
}

async function listRecursive(
  baseUrl: string,
  key: string,
  bucket: string,
  prefix: string
): Promise<string[]> {
  const listUrl = `${baseUrl}/storage/v1/object/list/${bucket}`;
  const res = await fetch(listUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefix, limit: 1000, offset: 0 }),
  });
  if (!res.ok) return [];
  const items = (await res.json()) as Array<{ name: string; id: string | null }>;
  const files: string[] = [];
  for (const item of items) {
    if (!item.name) continue;
    const full = prefix ? `${prefix}/${item.name}`.replace(/\/+/g, "/") : item.name;
    if (item.id) {
      files.push(full);
    } else {
      files.push(...(await listRecursive(baseUrl, key, bucket, full)));
    }
  }
  return files;
}

function localDest(prefix: string, objectPath: string): string {
  const root = process.env.STORAGE_ROOT!;
  const rel = objectPath.replace(/^\/+/, "");
  // DB paths: board/, teeth-ocr/, teeth-orders/ — map to local folders per local.ts
  if (rel.startsWith("board/")) {
    return path.join(root, "department-board", rel.slice("board/".length));
  }
  if (rel.startsWith("teeth-ocr/")) {
    return path.join(root, "teeth-ocr", rel.slice("teeth-ocr/".length));
  }
  if (rel.startsWith("teeth-orders/")) {
    return path.join(root, "teeth-orders", rel.slice("teeth-orders/".length));
  }
  return path.join(root, prefix, rel);
}

async function downloadObject(
  baseUrl: string,
  key: string,
  bucket: string,
  objectPath: string,
  dest: string
) {
  const encoded = objectPath.split("/").map(encodeURIComponent).join("/");
  const res = await fetch(
    `${baseUrl}/storage/v1/object/authenticated/${bucket}/${encoded}`,
    { headers: { Authorization: `Bearer ${key}`, apikey: key } }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  return createHash("sha256").update(buf).digest("hex");
}

async function main() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(
    /\/$/,
    ""
  );
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const root = process.env.STORAGE_ROOT;
  if (!url || !key || !root) {
    console.error("Wymagane: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STORAGE_ROOT");
    process.exit(1);
  }

  const manifestPath = arg("--manifest");
  let entries: StorageEntry[] = [];

  if (manifestPath && existsSync(manifestPath)) {
    entries = JSON.parse(readFileSync(manifestPath, "utf-8")) as StorageEntry[];
    console.log(`manifest: ${entries.length} obiektów`);
  } else {
    for (const bucket of BUCKETS) {
      const paths = await listRecursive(url, key, bucket.id, "");
      for (const p of paths) {
        entries.push({ bucket_id: bucket.id, name: p });
      }
    }
    console.log(`API list: ${entries.length} plików`);
  }

  const report: string[] = ["path,sha256,ok"];
  let ok = 0;
  let fail = 0;

  for (const entry of entries) {
    const bucket = BUCKETS.find((b) => b.id === entry.bucket_id);
    if (!bucket) continue;
    const label = `${entry.bucket_id}/${entry.name}`;
    try {
      const sha = await downloadObject(url, key, entry.bucket_id, entry.name, localDest(bucket.prefix, entry.name));
      report.push(`${label},${sha},true`);
      ok += 1;
    } catch (e) {
      if (fail < 3) console.error(`FAIL ${label}:`, e instanceof Error ? e.message : e);
      report.push(`${label},,false`);
      fail += 1;
    }
  }

  console.log(report.join("\n"));
  console.log(`\nstorage migrate: ${ok} OK, ${fail} failed, ${entries.length} total`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
