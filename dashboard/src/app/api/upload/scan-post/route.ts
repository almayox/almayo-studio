import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scanFileBuffer } from "@/lib/fileScan";
import { isAllowedAdmin } from "@/lib/adminAccess";
import { isSafeObjectPath, isUploadBucket } from "@/lib/uploadPaths";

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isAllowedAdmin(supabase, user.email))) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { bucket?: unknown; path?: unknown }
    | null;
  const bucket = typeof body?.bucket === "string" ? body.bucket : "studio-files";
  const path = typeof body?.path === "string" ? body.path : "";
  if (!isUploadBucket(bucket) || !isSafeObjectPath(path)) {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }

  // Only files uploaded moments ago may be scanned (and removed on failure).
  const stamp = Number(path.slice(path.lastIndexOf("/") + 1).split("-")[0]);
  if (!Number.isFinite(stamp) || Math.abs(Date.now() - stamp) > 30 * 60 * 1000) {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(bucket).download(path);
  if (error || !data) {
    return NextResponse.json({ message: "File not found." }, { status: 404 });
  }

  const buffer = new Uint8Array(await data.arrayBuffer());
  const scan = await scanFileBuffer(
    buffer,
    path.split("/").pop() || "upload.bin",
    data.type,
    MAX_BYTES,
  );
  if (!scan.ok) {
    await admin.storage.from(bucket).remove([path]);
    return NextResponse.json({ message: scan.reason }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
