"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { Check, Layers, Lock, MessageCircle, Pencil, Play } from "lucide-react";
import { ProtectedMedia } from "./ProtectedMedia";
import { ReviewPostDialog } from "./ReviewPostDialog";
import type { ReviewCampaign, ReviewComment, ReviewPost } from "./types";

const NAME_KEY = "review-name";

/** The name saved in this browser on an earlier visit, or "". */
function readSavedName() {
  try {
    return window.localStorage.getItem(NAME_KEY) || "";
  } catch {
    // Private browsing: the name is simply not remembered.
    return "";
  }
}

const noSubscription = () => () => {};

async function readMessage(res: Response, fallback: string) {
  const data = (await res.json().catch(() => ({}))) as { message?: string };
  return data.message || fallback;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <span className="absolute left-1.5 top-1.5 rounded-full bg-emerald-600 p-1 text-white shadow">
        <Check size={11} strokeWidth={3} aria-hidden />
      </span>
    );
  }
  if (status === "changes_requested") {
    return (
      <span className="absolute left-1.5 top-1.5 rounded-full bg-amber-500 p-1 text-white shadow">
        <Pencil size={11} strokeWidth={3} aria-hidden />
      </span>
    );
  }
  return null;
}

export function CampaignReviewClient({
  token,
  campaign,
  posts: initialPosts,
  comments: initialComments,
}: {
  token: string;
  campaign: ReviewCampaign;
  posts: ReviewPost[];
  comments: ReviewComment[];
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [comments, setComments] = useState(initialComments);
  const savedName = useSyncExternalStore(noSubscription, readSavedName, () => "");
  const [typedName, setTypedName] = useState<string | null>(null);
  const name = typedName ?? savedName;
  const [nameDraft, setNameDraft] = useState("");
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // The review accepts answers only while the studio has it out for review.
  const open = campaign.status === "review";
  const approved = posts.filter((post) => post.approval_status === "approved").length;
  const changes = posts.filter((post) => post.approval_status === "changes_requested").length;
  const openIndex = posts.findIndex((post) => post.id === openPostId);
  const openPost = openIndex >= 0 ? posts[openIndex] : null;

  function rememberName(value: string) {
    setTypedName(value);
    try {
      window.localStorage.setItem(NAME_KEY, value);
    } catch {
      // Not remembered.
    }
  }

  const closePost = useCallback(() => {
    setOpenPostId(null);
    setError(null);
  }, []);

  function requireName() {
    if (name.trim()) return true;
    setError("Enter your name first.");
    return false;
  }

  async function answer(postId: string, approval_status: "approved" | "changes_requested") {
    if (!requireName()) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/review/${token}/approval`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId: postId, approval_status, author_name: name }),
    });
    setBusy(false);
    if (!res.ok) return setError(await readMessage(res, "Could not save your answer."));
    setPosts((current) =>
      current.map((post) => (post.id === postId ? { ...post, approval_status } : post)),
    );
  }

  async function comment(postId: string, body: string, audio: Blob | null) {
    if (!requireName()) return false;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append("assetId", postId);
    form.append("author_name", name);
    form.append("body", body);
    if (audio) form.append("audio", audio, "voice-note");
    const res = await fetch(`/api/review/${token}/comment`, { method: "POST", body: form });
    setBusy(false);
    if (!res.ok) {
      setError(await readMessage(res, "Could not post your comment."));
      return false;
    }
    const data = (await res.json()) as { comment: ReviewComment };
    setComments((current) => [...current, data.comment]);
    return true;
  }

  async function decide(client_decision: "approved" | "changes_requested") {
    if (!requireName()) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/review/${token}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_decision, author_name: name }),
    });
    if (!res.ok) {
      setBusy(false);
      setConfirming(false);
      return setError(await readMessage(res, "Could not submit your decision."));
    }
    // The server now renders the locked page.
    window.location.reload();
  }

  const profileName = (campaign.clientName || campaign.title).trim();
  const stats = [
    { label: "Posts", value: posts.length, tone: "text-navy" },
    { label: "Approved", value: approved, tone: "text-emerald-600" },
    { label: "Changes", value: changes, tone: changes ? "text-amber-600" : "text-navy/35" },
    {
      label: "Waiting",
      value: posts.length - approved - changes,
      tone: posts.length - approved - changes ? "text-navy" : "text-navy/35",
    },
  ];

  // Fills the last row of the grid so empty places show as dashed frames.
  const emptyCells = (3 - (posts.length % 3)) % 3;

  // The first thing a reviewer does is say who they are.
  if (open && !name.trim()) {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (nameDraft.trim()) rememberName(nameDraft.trim());
        }}
        className="mx-auto max-w-md space-y-4 rounded-3xl border border-mist bg-white p-6"
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-navy/45">
            Content review
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl text-navy">
            {campaign.title}
          </h1>
          <p className="mt-2 text-sm text-navy/60">
            {[campaign.clientName, campaign.month].filter(Boolean).join(" · ")}
          </p>
        </div>
        <label className="block text-sm font-medium text-navy">
          Write your name to start
          <input
            required
            autoFocus
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
            autoComplete="name"
            maxLength={120}
            className="mt-1.5 w-full rounded-xl border border-mist bg-foam px-3 py-2.5 outline-none ring-navy/30 focus:ring-2"
          />
        </label>
        <p className="text-xs text-navy/55">
          Your name is saved with every approval and comment you give.
        </p>
        <button
          type="submit"
          className="w-full rounded-xl bg-navy px-4 py-3 text-sm font-semibold text-white"
        >
          See the posts
        </button>
      </form>
    );
  }

  const decidedOn = campaign.decidedAt ? new Date(campaign.decidedAt).toLocaleString() : "";

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-navy/45">
          Content review
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl text-navy">
          {campaign.title}
        </h1>
        <p className="mt-2 text-sm text-navy/60">
          {[campaign.month, campaign.platforms].filter(Boolean).join(" · ")}
        </p>
        {campaign.note ? (
          <p className="mt-4 max-w-2xl whitespace-pre-wrap text-navy/70">{campaign.note}</p>
        ) : null}
      </header>

      {campaign.status === "approved" ? (
        <div className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <Lock size={18} className="mt-0.5 shrink-0" aria-hidden />
          <div className="text-sm">
            <p className="font-semibold">
              Approved{campaign.decidedBy ? ` by ${campaign.decidedBy}` : ""}
              {decidedOn ? ` on ${decidedOn}` : ""}
            </p>
            <p className="mt-1">
              This review is locked and can no longer be changed.{" "}
              {campaign.released
                ? "The original files are ready: open a post to download it."
                : "The full-quality original files are delivered once payment is received."}
            </p>
          </div>
        </div>
      ) : null}

      {campaign.status === "changes_requested" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">
            Change requests sent{campaign.decidedBy ? ` by ${campaign.decidedBy}` : ""}
            {decidedOn ? ` on ${decidedOn}` : ""}
          </p>
          <p className="mt-1">
            I am working on the updates. You will get this link again when they are ready.
          </p>
        </div>
      ) : null}

      {open ? (
        <p className="text-sm text-navy/65">
          Reviewing as <span className="font-semibold text-navy">{name.trim()}</span>
          {" · "}
          <button
            type="button"
            onClick={() => {
              setNameDraft(name.trim());
              rememberName("");
            }}
            className="underline underline-offset-2 hover:text-navy"
          >
            Change
          </button>
          <br />
          Open each post, approve it or ask for changes, then send your answer at the bottom.
        </p>
      ) : null}

      <section className="w-full overflow-hidden rounded-3xl border border-mist bg-white shadow-sm">
        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-5">
            <div className="shrink-0 rounded-full bg-gradient-to-tr from-accent via-accent/60 to-navy p-[3px]">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-[3px] border-white bg-navy text-3xl font-semibold text-white sm:h-24 sm:w-24">
                {campaign.clientLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={campaign.clientLogo}
                    alt=""
                    className="h-full w-full bg-white object-contain"
                  />
                ) : (
                  profileName.charAt(0).toUpperCase()
                )}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="truncate font-[family-name:var(--font-display)] text-2xl text-navy">
                {profileName}
              </h2>
              <p className="mt-0.5 text-sm text-navy/55">
                {[campaign.month, campaign.platforms].filter(Boolean).join(" · ") || "Content preview"}
              </p>
            </div>

            <dl className="flex w-full justify-between gap-6 text-center sm:w-auto sm:justify-start sm:gap-9">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <dd className={`font-[family-name:var(--font-display)] text-2xl ${stat.tone}`}>
                    {stat.value}
                  </dd>
                  <dt className="text-xs text-navy/55">{stat.label}</dt>
                </div>
              ))}
            </dl>
          </div>

          {posts.length ? (
            <div className="mt-6">
              <div
                role="progressbar"
                aria-label="Posts approved"
                aria-valuemin={0}
                aria-valuemax={posts.length}
                aria-valuenow={approved}
                className="flex h-1.5 overflow-hidden rounded-full bg-mist/70"
              >
                <span
                  className="bg-emerald-500 transition-all"
                  style={{ width: `${(approved / posts.length) * 100}%` }}
                />
                <span
                  className="bg-amber-400 transition-all"
                  style={{ width: `${(changes / posts.length) * 100}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-navy/55">
                {approved === posts.length
                  ? "Every post is approved."
                  : `${approved} of ${posts.length} approved${changes ? `, ${changes} with change requests` : ""}.`}
              </p>
            </div>
          ) : null}
        </div>

        {posts.length === 0 ? (
          <p className="border-t border-mist p-8 text-center text-sm text-navy/50">
            No posts have been added yet.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-0.5 border-t border-mist bg-mist">
            {posts.map((post, index) => {
              const count = comments.filter((item) => item.asset_id === post.id).length;
              return (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => setOpenPostId(post.id)}
                  aria-label={`Open post ${index + 1}`}
                  className="group relative bg-foam focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy"
                >
                  {post.media[0] ? (
                    <ProtectedMedia
                      media={post.media[0]}
                      alt={post.title}
                      released={campaign.released}
                      className="aspect-[4/5] w-full"
                    />
                  ) : (
                    <div className="aspect-[4/5] w-full bg-mist/40" />
                  )}
                  <StatusBadge status={post.approval_status} />
                  <span className="absolute right-1.5 top-1.5 text-white drop-shadow">
                    {post.media.length > 1 ? <Layers size={15} aria-hidden /> : null}
                    {post.media.length <= 1 && post.media[0]?.video ? (
                      <Play size={15} aria-hidden />
                    ) : null}
                  </span>
                  {count ? (
                    <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-full bg-navy-deep/70 px-1.5 py-0.5 text-[10px] text-white">
                      <MessageCircle size={10} aria-hidden />
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
            {Array.from({ length: emptyCells }, (_, index) => (
              <div key={`empty-${index}`} aria-hidden className="bg-white p-1">
                <div className="aspect-[4/5] w-full rounded-md border-2 border-dashed border-mist" />
              </div>
            ))}
          </div>
        )}
      </section>

      {!openPost && error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {open && posts.length ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-mist bg-white/95 py-3 pl-5 pr-24 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-navy/70">
              <span className="font-semibold text-navy">
                {approved} of {posts.length}
              </span>{" "}
              approved{changes ? ` · ${changes} need changes` : ""}
            </p>
            {changes > 0 ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => decide("changes_requested")}
                className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                Send {changes} change request{changes === 1 ? "" : "s"}
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => (requireName() ? setConfirming(true) : undefined)}
                className="rounded-xl bg-navy px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                Approve all {posts.length} posts
              </button>
            )}
          </div>
        </div>
      ) : null}

      {confirming ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy-deep/70" />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="relative z-10 w-full max-w-md rounded-3xl bg-white p-6"
          >
            <h2
              id="confirm-title"
              className="font-[family-name:var(--font-display)] text-2xl text-navy"
            >
              Approve and lock?
            </h2>
            <p className="mt-3 text-sm text-navy/70">
              You are approving all {posts.length} posts as <strong>{name.trim()}</strong>. After
              this the review is locked: answers and comments can no longer be changed.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirming(false)}
                className="flex-1 rounded-xl border border-navy/20 px-4 py-2.5 text-sm font-semibold text-navy"
              >
                Go back
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => decide("approved")}
                className="flex-1 rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? "Saving…" : "Approve and lock"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {openPost ? (
        <ReviewPostDialog
          key={openPost.id}
          post={openPost}
          profileName={profileName}
          profileLogo={campaign.clientLogo}
          position={openIndex}
          total={posts.length}
          comments={comments.filter((item) => item.asset_id === openPost.id)}
          released={campaign.released}
          open={open}
          busy={busy}
          error={error}
          onAnswer={(status) => answer(openPost.id, status)}
          onComment={(body, audio) => comment(openPost.id, body, audio)}
          onStep={(direction) => {
            setError(null);
            setOpenPostId(posts[openIndex + direction]?.id ?? openPost.id);
          }}
          onClose={closePost}
        />
      ) : null}
    </div>
  );
}
