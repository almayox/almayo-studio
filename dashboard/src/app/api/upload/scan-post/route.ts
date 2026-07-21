import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scanFileBuffer } from "@/lib/fileScan";

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { bucket?: string; path?: string };
  const bucket = body.bucket || "studio-files";
  const path = body.path || "";
  if (!path || !["studio-files", "project-media"].includes(bucket)) {
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
