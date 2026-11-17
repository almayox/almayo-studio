"use client";

import { FormEvent, useMemo, useState } from "react";

type Slide = {
  id: string;
  media_url: string;
  caption: string | null;
  sort_order: number;
};

type Asset = {
  id: string;
  title: string;
  caption: string | null;
  hashtags: string | null;
  publish_date: string | null;
  media_url: string | null;
  approval_status: string;
  type: string;
  campaign_asset_slides?: Slide[];
};

const TYPE_LABELS: Record<string, string> = {
  single: "Single post",
  carousel: "Carousel",
  reel: "Reel",
  video: "Video",
  story: "Story",
};

const APPROVAL_LABELS: Record<string, string> = {
  pending: "Waiting for your review",
  approved: "Approved",
  changes_requested: "Changes requested",
};

/** Signed links keep the file name, so the extension tells a video from an image. */
function isVideoUrl(url: string) {
  return /\.(mp4|mov|m4v|webm)(\?|$)/i.test(url);
}

const mediaClass = "aspect-square w-full object-cover";

type Comment = {
  id: string;
  asset_id: string;
  author_name: string;
  body: string | null;
  created_at: string;
};

function AssetMedia({ asset }: { asset: Asset }) {
  const slides = useMemo(
    () =>
      (asset.campaign_asset_slides || [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order),
    [asset.campaign_asset_slides],
  );
  const [index, setIndex] = useState(0);

  if (slides.length > 0) {
    const slide = slides[Math.min(index, slides.length - 1)];
    return (
      <div className="overflow-hidden rounded-xl bg-foam">
        {isVideoUrl(slide.media_url) ? (
          <video key={slide.id} src={slide.media_url} controls playsInline className={mediaClass} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={slide.media_url} alt={slide.caption || asset.title} className={mediaClass} />
        )}
        {slides.length > 1 ? (
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
              className="text-xs font-medium text-navy"
            >
              Prev
            </button>
            <p className="text-xs text-navy/55">
              {index + 1} / {slides.length}
            </p>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % slides.length)}
              className="text-xs font-medium text-navy"
            >
              Next
            </button>
          </div>
        ) : null}
        {slide.caption ? (
          <p className="border-t border-mist px-3 py-2 text-xs text-navy/60">{slide.caption}</p>
        ) : null}
      </div>
    );
  }

  if (!asset.media_url) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-xl bg-foam text-navy/40">
        No media
      </div>
    );
  }

  if (asset.type === "video" || asset.type === "reel" || isVideoUrl(asset.media_url)) {
    return (
      <video src={asset.media_url} controls playsInline className={`${mediaClass} rounded-xl`} />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={asset.media_url}
      alt={asset.title}
      className="aspect-square w-full rounded-xl object-cover"
    />
  );
}

export function CampaignReviewClient({
  token,
  title,
  objectives,
  platforms,
  assets,
  comments,
  alreadyDecided,
  decision,
  passwordRequired,
  initialUnlocked,
}: {
  token: string;
  title: string;
  objectives: string | null;
  platforms: string | null;
  assets: Asset[];
  comments: Comment[];
  alreadyDecided: boolean;
  decision: string | null;
  passwordRequired: boolean;
  initialUnlocked: boolean;
}) {
  const unlocked = initialUnlocked;
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [localAssets, setLocalAssets] = useState(assets);
  const [localComments, setLocalComments] = useState(comments);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function unlock(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const res = await fetch(`/api/review/${token}/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      setError(data.message || "Incorrect password.");
      return;
    }
    // Content is only rendered by the server once the access cookie is set.
    window.location.reload();
  }

  async function setApproval(assetId: string, approval_status: string) {
    setError(null);
    const res = await fetch(`/api/review/${token}/approval`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId, approval_status }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      setError(data.message || "Could not update asset.");
      return;
    }
    setLocalAssets((prev) =>
      prev.map((a) => (a.id === assetId ? { ...a, approval_status } : a)),
    );
  }

  async function addComment(assetId: string) {
    const body = (commentDrafts[assetId] || "").trim();
    if (!body || !name.trim()) {
      setError("Enter your name and a comment.");
      return;
    }
    setError(null);
    const res = await fetch(`/api/review/${token}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId, author_name: name, body }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      setError(data.message || "Could not post comment.");
      return;
    }
    const data = (await res.json()) as { comment: Comment };
    setLocalComments((prev) => [...prev, data.comment]);
    setCommentDrafts((prev) => ({ ...prev, [assetId]: "" }));
  }

  async function submitDecision(client_decision: "approved" | "changes_requested") {
    setStatus("loading");
    setError(null);
    try {
      if (!name.trim()) throw new Error("Enter your name before submitting.");
      const res = await fetch(`/api/review/${token}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_decision, author_name: name }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(data.message || "Could not submit decision");
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not submit decision");
    }
  }

  if (passwordRequired && !unlocked) {
    return (
      <form
        onSubmit={unlock}
        className="mx-auto max-w-md space-y-4 rounded-2xl border border-mist bg-white p-6"
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-navy/45">
            Protected review
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl text-navy">
            {title}
          </h1>
          <p className="mt-2 text-sm text-navy/60">Enter the review password to continue.</p>
        </div>
        <label className="block text-sm font-medium text-navy">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-mist bg-foam px-3 py-2.5 outline-none ring-navy/30 focus:ring-2"
          />
        </label>
        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
        <button
          type="submit"
          className="w-full rounded-xl bg-navy px-4 py-3 text-sm font-semibold text-white"
        >
          Unlock review
        </button>
      </form>
    );
  }

  if (alreadyDecided || status === "done") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900">
        <p className="font-[family-name:var(--font-display)] text-2xl">Review submitted</p>
        <p className="mt-2 text-sm">Decision: {decision || "recorded"}. Thank you.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-navy/45">
          Campaign review
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl text-navy">
          {title}
        </h1>
        {platforms ? <p className="mt-2 text-sm text-navy/60">{platforms}</p> : null}
        {objectives ? (
          <p className="mt-4 whitespace-pre-wrap text-navy/70">{objectives}</p>
        ) : null}
      </div>

      <label className="block max-w-md text-sm font-medium text-navy">
        Your name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-mist bg-white px-3 py-2.5 outline-none ring-navy/30 focus:ring-2"
        />
      </label>

      <div className="space-y-6">
        {localAssets.map((asset) => {
          const assetComments = localComments.filter((c) => c.asset_id === asset.id);
          return (
            <section key={asset.id} className="rounded-2xl border border-mist bg-white p-5">
              <div className="grid gap-5 md:grid-cols-[220px_1fr]">
                <AssetMedia asset={asset} />
                <div>
                  <h2 className="font-[family-name:var(--font-display)] text-xl text-navy">
                    {asset.title}
                  </h2>
                  <p className="mt-1 text-xs text-navy/55">
                    {TYPE_LABELS[asset.type] || asset.type}
                    {asset.publish_date ? ` · Planned for ${asset.publish_date}` : ""}
                  </p>
                  {asset.caption ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-navy/70">{asset.caption}</p>
                  ) : null}
                  {asset.hashtags ? (
                    <p className="mt-2 text-sm text-navy/55">{asset.hashtags}</p>
                  ) : null}
                  <p className="mt-3 text-xs uppercase tracking-wide text-navy/45">
                    {APPROVAL_LABELS[asset.approval_status] || asset.approval_status}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      ["approved", "Approve"],
                      ["changes_requested", "Request changes"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setApproval(asset.id, value)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                          asset.approval_status === value
                            ? "bg-navy text-white"
                            : "bg-foam text-navy ring-1 ring-mist"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-5 space-y-2">
                    {assetComments.map((comment) => (
                      <div key={comment.id} className="rounded-lg bg-foam px-3 py-2 text-sm">
                        <p className="font-medium text-navy">{comment.author_name}</p>
                        <p className="text-navy/70">{comment.body}</p>
                      </div>
                    ))}
                    <textarea
                      rows={2}
                      value={commentDrafts[asset.id] || ""}
                      onChange={(e) =>
                        setCommentDrafts((prev) => ({ ...prev, [asset.id]: e.target.value }))
                      }
                      placeholder="Add a comment…"
                      className="w-full rounded-lg border border-mist bg-foam px-3 py-2 text-sm outline-none ring-navy/30 focus:ring-2"
                    />
                    <button
                      type="button"
                      onClick={() => addComment(asset.id)}
                      className="rounded-lg bg-navy/90 px-3 py-1.5 text-xs font-medium text-white"
                    >
                      Post comment
                    </button>
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={status === "loading"}
          onClick={() => submitDecision("approved")}
          className="rounded-xl bg-navy px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          Approve campaign
        </button>
        <button
          type="button"
          disabled={status === "loading"}
          onClick={() => submitDecision("changes_requested")}
          className="rounded-xl border border-navy/20 px-6 py-3 text-sm font-semibold text-navy disabled:opacity-60"
        >
          Request changes
        </button>
      </div>
    </div>
  );
}
