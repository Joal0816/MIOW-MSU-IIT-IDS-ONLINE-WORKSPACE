// Local filesystem storage — replaces Supabase Storage buckets.
// Buckets: "avatars" and "course-materials"
// Stored under `storage/<bucket>/<path>` on the server filesystem.
// Served via `src/routes/api/public/(avatar|material).ts` download handlers.

import fs from "node:fs/promises";
import path from "node:path";

const STORAGE_ROOT = process.env["STORAGE_PATH"] ?? path.join(process.cwd(), "storage");

type StorageError = { message: string; code?: string };

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export const storage = {
  from(bucket: string) {
    const bucketRoot = path.join(STORAGE_ROOT, bucket);
    return {
      async upload(
        filePath: string,
        data: Buffer | Uint8Array,
        opts?: { contentType?: string; upsert?: boolean },
      ): Promise<{ data: { path: string } | null; error: StorageError | null }> {
        try {
          const full = path.join(bucketRoot, filePath);
          // Prevent path traversal: filePath must stay inside bucketRoot
          if (!full.startsWith(bucketRoot)) {
            return { data: null, error: { message: "Invalid path" } };
          }
          await ensureDir(path.dirname(full));
          if (!opts?.upsert) {
            try {
              await fs.access(full);
              return { data: null, error: { message: "File already exists" } };
            } catch {
              // not exists → ok
            }
          }
          const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
          await fs.writeFile(full, buf);
          // Store content-type alongside as sidecar if needed (not required for download)
          if (opts?.contentType) {
            try {
              await fs.writeFile(
                full + ".meta.json",
                JSON.stringify({ contentType: opts.contentType }),
              );
            } catch {
              // ignore
            }
          }
          return { data: { path: filePath }, error: null };
        } catch (e: unknown) {
          const err = e as { message?: string };
          return { data: null, error: { message: err?.message ?? String(e) } };
        }
      },

      async download(filePath: string): Promise<{ data: Blob | null; error: StorageError | null }> {
        try {
          const full = path.join(bucketRoot, filePath);
          if (!full.startsWith(bucketRoot)) {
            return { data: null, error: { message: "Invalid path" } };
          }
          const buf = await fs.readFile(full);
          // Return as Blob-like (Node 18+ has global Blob)
          const blob = new Blob([buf]);
          return { data: blob as unknown as Blob, error: null };
        } catch (e: unknown) {
          const err = e as { message?: string; code?: string };
          if ((err as { code?: string })?.code === "ENOENT") {
            return { data: null, error: { message: "Not found", code: "ENOENT" } };
          }
          return { data: null, error: { message: err?.message ?? String(e) } };
        }
      },

      async remove(paths: string[]): Promise<{ data: unknown; error: StorageError | null }> {
        try {
          for (const p of paths) {
            const full = path.join(bucketRoot, p);
            if (!full.startsWith(bucketRoot)) continue;
            try {
              await fs.unlink(full);
              // also remove sidecar
              try {
                await fs.unlink(full + ".meta.json");
              } catch {
                // ignore
              }
            } catch {
              // best-effort: file may not exist
            }
          }
          return { data: {}, error: null };
        } catch (e: unknown) {
          const err = e as { message?: string };
          return { data: null, error: { message: err?.message ?? String(e) } };
        }
      },
    };
  },
};
