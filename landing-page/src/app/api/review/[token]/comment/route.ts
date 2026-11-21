import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, clientIp, stringField } from "@/lib/rateLimit";
import { assertReviewAccess } from "@/lib/reviewAccess";
import { getReviewCampaignByToken, logReviewEvent } from "@/lib/reviewServer";
import { signStorageUrl, toStoredStorageUrl } from "@/lib/storage";

const MAX_AUDIO_BYTES = 3 * 1024 * 1024;
const AUDIO_EXTENSIONS: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/aac": "aac",
  "audio/wav": "wav",
};

/** A text comment, a voice note, or both, on one post. Sent as form data. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const ip = clientIp(request);
  const limit = await checkRateLimit({
    key: `review-comment:${ip}:${token}`,
    limit: 40,
    windowMs: 15 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json({ message: "Too many requests." }, { status: 429 });
  }

  const campaign = await getReviewCampaignByToken(token);
  if (!campaign) {
    return NextResponse.json({ message: "Review not found." }, { status: 404 });
  }

  const access = await assertReviewAccess(token, Boolean(campaign.review_password_hash));
  if (!access.ok) {
    return NextResponse.json({ message: access.message }, { status: access.status });
  }

  if (campaign.status !== "review") {
    return NextResponse.json({ message: "This review is locked." }, { status: 409 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }
  const assetId = stringField(form.get("assetId"), 64);
  const author_name = stringField(form.get("author_name"), 120);
  const rawBody = form.get("body");
  const commentBody = typeof rawBody === "string" ? rawBody.trim() : "";
  const audio = form.get("audio");
  const hasAudio = audio instanceof File && audio.size > 0;

  if (!assetId || !author_name) {
    return NextResponse.json({ message: "Enter your name first." }, { status: 400 });
  }
  if (!hasAudio && commentBody.length < 2) {
    return NextResponse.json({ message: "Write a comment or record a voice note." }, { status: 400 });
  }
  if (commentBody.length > 4000) {
    return NextResponse.json({ message: "Comment is too long." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: asset } = await supabase
    .from("campaign_assets")
    .select("id, title")
    .eq("id", assetId)
    .eq("campaign_id", campaign.id)
    .maybeSingle();

  if (!asset) {
    return NextResponse.json({ message: "Post not found." }, { status: 404 });
  }

  let audioUrl: string | null = null;
  if (hasAudio) {
    // Browsers report e.g. "audio/webm;codecs=opus".
    const mime = audio.type.split(";")[0].trim().toLowerCase();
    const ext = AUDIO_EXTENSIONS[mime];
    if (!ext) {
      return NextResponse.json({ message: "This audio format is not supported." }, { status: 400 });
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { message: "Voice note is too long. Keep it under two minutes." },
        { status: 400 },
      );
    }
    const path = `campaigns/${campaign.id}/voice/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("studio-files")
      .upload(path, new Uint8Array(await audio.arrayBuffer()), {
        upsert: false,
        contentType: mime,
      });
    if (uploadError) {
      return NextResponse.json({ message: "Could not save the voice note." }, { status: 500 });
    }
    audioUrl = toStoredStorageUrl("studio-files", path);
  }

  const { data, error } = await supabase
    .from("campaign_comments")
    .insert({
      asset_id: assetId,
      author_name,
      body: commentBody || null,
      ...(audioUrl ? { audio_url: audioUrl } : {}),
    })
    .select("id, asset_id, author_name, body, audio_url, from_studio, created_at")
    .single();

  if (error) {
    return NextResponse.json({ message: "Could not post comment." }, { status: 500 });
  }

  await logReviewEvent(campaign.id, {
    kind: audioUrl ? "voice_note" : "comment",
    assetId,
    actor: author_name,
    detail: `${asset.title}${commentBody ? `: ${commentBody}` : ""}`,
    ip,
  });

  return NextResponse.json({
    comment: { ...data, audio_url: audioUrl ? await signStorageUrl(audioUrl) : null },
  });
}
