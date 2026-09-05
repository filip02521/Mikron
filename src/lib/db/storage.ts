import path from "path";
import {
  deleteStorageObject,
  signStoragePath,
  writeStorageObject,
} from "@/lib/storage/local";

const BUCKET_PREFIX: Record<string, string> = {
  "teeth-ocr-images": "teeth-ocr/",
  "teeth-order-files": "teeth-orders/",
  "department-board-images": "board/",
};

function toDbPath(bucket: string, objectPath: string): string {
  const prefix = BUCKET_PREFIX[bucket];
  const rel = objectPath.replace(/^\/+/, "");
  if (prefix && (rel.startsWith("board/") || rel.startsWith("teeth-ocr/") || rel.startsWith("teeth-orders/"))) {
    return rel;
  }
  if (prefix) return `${prefix}${rel}`;
  return rel;
}

function extOf(name: string): string {
  const ext = path.extname(name).toLowerCase();
  return ext || ".bin";
}

async function toBuffer(body: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof ArrayBuffer) return Buffer.from(body);
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (typeof Blob !== "undefined" && body instanceof Blob) {
    return Buffer.from(await body.arrayBuffer());
  }
  if (typeof body === "string") return Buffer.from(body);
  throw new Error("Unsupported upload body");
}

export function createLocalStorage() {
  return {
    from(bucket: string) {
      return {
        async upload(objectPath: string, body: unknown, _opts?: { contentType?: string; upsert?: boolean }) {
          try {
            const dbPath = toDbPath(bucket, objectPath);
            await writeStorageObject(dbPath, await toBuffer(body));
            return { data: { path: objectPath }, error: null };
          } catch (error) {
            return {
              data: null,
              error: { message: error instanceof Error ? error.message : "upload failed" },
            };
          }
        },
        async remove(paths: string[]) {
          try {
            for (const p of paths ?? []) {
              await deleteStorageObject(toDbPath(bucket, p));
            }
            return { data: paths, error: null };
          } catch (error) {
            return {
              data: null,
              error: { message: error instanceof Error ? error.message : "remove failed" },
            };
          }
        },
        async createSignedUrl(objectPath: string, expiresIn: number, userId = "system") {
          try {
            const dbPath = toDbPath(bucket, objectPath);
            const token = signStoragePath(dbPath, userId, expiresIn);
            return {
              data: { signedUrl: `/api/storage/file?token=${encodeURIComponent(token)}` },
              error: null,
            };
          } catch (error) {
            return {
              data: null,
              error: {
                message: error instanceof Error ? error.message : "signed url failed",
              },
            };
          }
        },
        async list() {
          return { data: [], error: null };
        },
        async download() {
          return { data: null, error: { message: "download via signed URL" } };
        },
        getPublicUrl(objectPath: string) {
          return { data: { publicUrl: `/api/storage/file?path=${encodeURIComponent(objectPath)}` } };
        },
        _ext: extOf,
      };
    },
  };
}
