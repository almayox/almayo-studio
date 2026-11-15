import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { scanFileBuffer } from "@/lib/fileScan";
import { createAdminClient } from "@/lib/supabase/admin";
import { toStoredStorageUrl } from "@/lib/storage";
import { isAllowedAdmin } from "@/lib/adminAccess";
import { isSafeFolder, isUploadBucket } from "@/lib/uploadPaths";

const MAX_BYTES = 25 * 1024 * 1024;

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isAllowedAdmin(supabase, user.email))) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ message: "Invalid upload." }, { status: 400 });
  }
  const file = form.get("file");
  const bucket = String(form.get("bucket") || "studio-files");
  const folder = String(form.get("folder") || "uploads");

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "File is required." }, { status: 400 });
  }
  if (!isUploadBucket(bucket)) {
    return NextResponse.json({ message: "Invalid bucket." }, { status: 400 });
  }
  if (!isSafeFolder(folder)) {
    return NextResponse.json({ message: "Invalid folder." }, { status: 400 });
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const scan = await scanFileBuffer(buffer, file.name, file.type, MAX_BYTES);
  if (!scan.ok) {
    return NextResponse.json({ message: scan.reason }, { status: 400 });
  }

  const ext = safeName(file.name.split(".").pop() || "bin");
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const admin = createAdminClient();
  const { error } = await admin.storage.from(bucket).upload(path, buffer, {
    upsert: false,
    contentType: scan.mime,
    // File names are unique per upload, so they can be cached for a year.
    cacheControl: "31536000",
  });
  if (error) {
    console.error("upload failed", error.message);
    return NextResponse.json({ message: "Could not store the file." }, { status: 500 });
  }

  const storedUrl = toStoredStorageUrl(bucket, path);
  const { data: signed } = await admin.storage.from(bucket).createSignedUrl(path, 3600);

  return NextResponse.json({
    url: storedUrl,
    displayUrl: signed?.signedUrl || storedUrl,
    path,
    bucket,
  });
}
