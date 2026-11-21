import { createClient } from "@/lib/supabase/client";
import * as tus from "tus-js-client";
import { GLB_MIME, validateUploadBasics } from "@/lib/fileScan";
import { toStoredStorageUrl } from "@/lib/storage";
import { compressVideo, needsVideoCompression } from "@/lib/videoCompress";

// Large enough for a full-width image on a high-density screen.
const IMAGE_MAX_EDGE = 2400;
const LOGO_MAX_EDGE = 512;
// Visually lossless for photos and artwork; the public site then serves
// right-sized AVIF/WebP versions of this master through its image optimiser.
const IMAGE_QUALITY = 0.9;
const LOGO_QUALITY = 0.92;
// Vercel rejects request bodies over 4.5 MB, so anything near that goes
// straight to storage with a resumable upload instead of through /api/upload.
const RESUMABLE_THRESHOLD = 4 * 1024 * 1024;
const CHUNK_SIZE = 6 * 1024 * 1024;
const API_MAX_BYTES = 25 * 1024 * 1024;

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
}

async function compressImage(
  file: File,
  maxEdge = IMAGE_MAX_EDGE,
  quality = IMAGE_QUALITY,
): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    return file;
  }
  const tinyThreshold = maxEdge <= LOGO_MAX_EDGE ? 80_000 : 400_000;
  if (file.size < tinyThreshold || file.type === "image/gif") return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const skipThreshold = maxEdge <= LOGO_MAX_EDGE ? 300_000 : 1_200_000;
  if (scale >= 1 && file.size < skipThreshold) {
    bitmap.close();
    return file;
  }

  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob: Blob | null = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/webp", quality);
  });

  const outBlob =
    blob ||
    (await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality),
    ));

  if (!outBlob || outBlob.size >= file.size * 0.95) return file;

  const ext = outBlob.type === "image/webp" ? "webp" : "jpg";
  const base = safeName(file.name.replace(/\.[^.]+$/, "")) || "image";
  return new File([outBlob], `${base}.${ext}`, { type: outBlob.type });
}

async function uploadViaApi(
  bucket: string,
  folder: string,
  file: File,
): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("bucket", bucket);
  form.append("folder", folder);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const data = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
  if (!res.ok) {
    throw new Error(
      data.message ||
        (res.status === 413
          ? "File is too large to upload this way."
          : res.status === 401
            ? "Your session expired. Sign in again."
            : `Upload failed (${res.status}).`),
    );
  }
  if (!data.url) throw new Error("Upload failed");
  return data.url;
}

async function scanLargeUpload(bucket: string, path: string) {
  const res = await fetch("/api/upload/scan-post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bucket, path }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(data.message || "Uploaded file failed security scan.");
  }
}

async function uploadResumable(
  bucket: string,
  path: string,
  file: File,
  onProgress?: (pct: number) => void,
  onPhase?: (phase: UploadPhase) => void,
): Promise<string> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sign in required to upload.");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${url}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000],
      headers: {
        authorization: `Bearer ${session.access_token}`,
        "x-upsert": "false",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: CHUNK_SIZE,
      metadata: {
        bucketName: bucket,
        objectName: path,
        contentType: file.type || "application/octet-stream",
        cacheControl: "31536000",
      },
      onError: (error) => reject(error),
      onProgress: (bytesUploaded, bytesTotal) => {
        if (!onProgress || !bytesTotal) return;
        onProgress(Math.round((bytesUploaded / bytesTotal) * 100));
      },
      onSuccess: () => resolve(),
    });
    upload.start();
  });

  onPhase?.("scanning");
  await scanLargeUpload(bucket, path);
  return toStoredStorageUrl(bucket, path);
}

/** A 3D model file, recognised by its name because browsers rarely label it. */
export function isGlbFile(file: File) {
  return /\.glb$/i.test(file.name);
}

export type UploadPhase = "compressing" | "uploading" | "scanning";

export type UploadOptions = {
  bucket?: string;
  folder: string;
  onProgress?: (pct: number) => void;
  onPhase?: (phase: UploadPhase) => void;
  optimizeImage?: boolean;
  maxEdge?: number;
  imageQuality?: number;
};

export function uploadStatusLabel(
  phase: UploadPhase | null | undefined,
  progress?: number | null,
) {
  if (phase === "compressing") {
    return typeof progress === "number" && progress > 0 && progress < 100
      ? `Compressing ${progress}%…`
      : "Compressing…";
  }
  if (phase === "scanning") return "Scanning…";
  if (typeof progress === "number" && progress > 0 && progress < 100) {
    return `Uploading ${progress}%…`;
  }
  return "Uploading…";
}

export async function uploadStudioFile(
  file: File,
  options: UploadOptions,
): Promise<string> {
  const bucket = options.bucket || "studio-files";
  const optimize = options.optimizeImage !== false;
  const maxEdge = options.maxEdge ?? IMAGE_MAX_EDGE;
  const quality = options.imageQuality ?? (maxEdge <= LOGO_MAX_EDGE ? LOGO_QUALITY : IMAGE_QUALITY);
  const shouldCompress = optimize && file.type.startsWith("image/");
  if (shouldCompress) options.onPhase?.("compressing");
  let prepared = file;
  if (shouldCompress) {
    try {
      prepared = await compressImage(file, maxEdge, quality);
    } catch {
      // Formats the browser cannot decode (e.g. HEIC) are uploaded untouched.
      prepared = file;
    }
  }

  // Videos over the storage limit are shrunk in the browser first, the same
  // way for every upload in the dashboard.
  if (needsVideoCompression(file)) {
    options.onPhase?.("compressing");
    options.onProgress?.(0);
    prepared = await compressVideo(file, (fraction) =>
      options.onProgress?.(Math.round(fraction * 100)),
    );
  }

  // Browsers often give a .glb file no type at all; storage needs the real one.
  if (isGlbFile(prepared) && prepared.type !== GLB_MIME) {
    prepared = new File([prepared], prepared.name, { type: GLB_MIME });
  }

  const basics = validateUploadBasics(prepared, API_MAX_BYTES);
  if (!basics.ok) throw new Error(basics.reason);

  const ext = prepared.name.split(".").pop() || "bin";
  const path = `${options.folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  options.onProgress?.(0);
  options.onPhase?.("uploading");

  if (prepared.size >= RESUMABLE_THRESHOLD) {
    const url = await uploadResumable(
      bucket,
      path,
      prepared,
      options.onProgress,
      options.onPhase,
    );
    options.onProgress?.(100);
    return url;
  }

  const url = await uploadViaApi(bucket, options.folder, prepared);
  options.onProgress?.(100);
  return url;
}
