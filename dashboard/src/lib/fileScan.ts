const BLOCKED_EXTENSIONS = new Set([
  "exe",
  "msi",
  "bat",
  "cmd",
  "com",
  "scr",
  "ps1",
  "vbs",
  "js",
  "jar",
  "sh",
  "php",
  "asp",
  "aspx",
  "cgi",
  "dll",
  "apk",
  "deb",
  "rpm",
  "svg",
  "svgz",
  "html",
  "htm",
  "xhtml",
]);

const ALLOWED_MIME_PREFIXES = ["image/", "video/", "application/pdf", "audio/"];

// SVG is intentionally not allowed: it can carry scripts and is served as-is.
const BLOCKED_MIME = new Set(["image/svg+xml", "text/html", "application/xhtml+xml"]);

const ALLOWED_MIME_EXACT = new Set([
  "application/zip",
  "application/x-zip-compressed",
]);

export type ScanResult =
  | { ok: true; mime: string }
  | { ok: false; reason: string };

function extensionOf(name: string) {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() || "" : "";
}

export function validateUploadBasics(file: File, maxBytes: number): ScanResult {
  if (file.size <= 0) return { ok: false, reason: "Empty file." };
  if (file.size > maxBytes) {
    return { ok: false, reason: `File exceeds ${Math.round(maxBytes / (1024 * 1024))}MB limit.` };
  }

  const ext = extensionOf(file.name);
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return { ok: false, reason: "This file type is not allowed." };
  }

  const mime = (file.type || "").toLowerCase();
  if (!mime || BLOCKED_MIME.has(mime)) {
    return { ok: false, reason: "Unsupported file type." };
  }
  if (
    !ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix)) &&
    !ALLOWED_MIME_EXACT.has(mime)
  ) {
    return { ok: false, reason: "Unsupported file type." };
  }

  return { ok: true, mime: mime || "application/octet-stream" };
}

async function detectMime(buffer: Uint8Array) {
  const { fileTypeFromBuffer } = await import("file-type");
  const detected = await fileTypeFromBuffer(buffer);
  return detected?.mime || null;
}

export async function scanFileBuffer(
  buffer: Uint8Array,
  fileName: string,
  declaredMime: string,
  maxBytes: number,
): Promise<ScanResult> {
  if (buffer.byteLength > maxBytes) {
    return { ok: false, reason: `File exceeds ${Math.round(maxBytes / (1024 * 1024))}MB limit.` };
  }

  const ext = extensionOf(fileName);
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return { ok: false, reason: "This file type is not allowed." };
  }

  const detectedMime = await detectMime(buffer);
  const mime = (detectedMime || declaredMime || "").toLowerCase();

  if (!mime || BLOCKED_MIME.has(mime) || BLOCKED_MIME.has((declaredMime || "").toLowerCase())) {
    return { ok: false, reason: "Unsupported file type." };
  }
  // Binary formats must be recognised from their content, not just their label.
  if (!detectedMime && /^(image|video|audio)\/|^application\/(pdf|zip|x-zip-compressed)$/.test(mime)) {
    return { ok: false, reason: "File content does not match its type." };
  }
  if (
    !ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix)) &&
    !ALLOWED_MIME_EXACT.has(mime)
  ) {
    return { ok: false, reason: "Unsupported file type." };
  }

  if (detectedMime && declaredMime && !declaredMime.includes(detectedMime.split("/")[0])) {
    return { ok: false, reason: "File content does not match its type." };
  }

  const vtKey = process.env.VIRUSTOTAL_API_KEY;
  if (vtKey) {
    const vt = await scanWithVirusTotal(buffer, vtKey);
    if (!vt.ok) return vt;
  }

  return { ok: true, mime: mime || "application/octet-stream" };
}

async function scanWithVirusTotal(
  buffer: Uint8Array,
  apiKey: string,
): Promise<ScanResult> {
  const form = new FormData();
  form.append(
    "file",
    new Blob([Buffer.from(buffer)], { type: "application/octet-stream" }),
    "upload.bin",
  );

  const uploadRes = await fetch("https://www.virustotal.com/api/v3/files", {
    method: "POST",
    headers: { "x-apikey": apiKey },
    body: form,
  });

  if (!uploadRes.ok) {
    return { ok: true, mime: "application/octet-stream" };
  }

  const uploadJson = (await uploadRes.json()) as { data?: { id?: string } };
  const analysisId = uploadJson.data?.id;
  if (!analysisId) return { ok: true, mime: "application/octet-stream" };

  for (let i = 0; i < 8; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const analysisRes = await fetch(
      `https://www.virustotal.com/api/v3/analyses/${analysisId}`,
      { headers: { "x-apikey": apiKey } },
    );
    if (!analysisRes.ok) continue;
    const analysisJson = (await analysisRes.json()) as {
      data?: { attributes?: { status?: string; stats?: { malicious?: number } } };
    };
    const status = analysisJson.data?.attributes?.status;
    if (status === "completed") {
      const malicious = analysisJson.data?.attributes?.stats?.malicious ?? 0;
      if (malicious > 0) {
        return { ok: false, reason: "File failed malware scan." };
      }
      return { ok: true, mime: "application/octet-stream" };
    }
  }

  return { ok: true, mime: "application/octet-stream" };
}
