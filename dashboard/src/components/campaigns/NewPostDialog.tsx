"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Film, Image as ImageIcon, Layers, X } from "lucide-react";
import { DropUpload } from "@/components/DropUpload";
import { PlatformPicker } from "@/components/campaigns/PlatformPicker";
import { Modal } from "@/components/ui/Modal";
import {
  fieldClass,
  labelClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/ui/PageChrome";
import { createPosts, fileFitsKind } from "@/lib/campaigns";
import { createClient } from "@/lib/supabase/client";

/** A picture of a chosen file, so it can be checked before it is uploaded. */
function FilePreview({
  file,
  label,
  disabled,
  onRemove,
}: {
  file: File;
  /** Small badge in the corner, e.g. the slide number. */
  label: string | null;
  disabled: boolean;
  onRemove: () => void;
}) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const video = file.type.startsWith("video/");
  const fits = isMedia(file);

  return (
    <div className={fits ? "" : "opacity-40"}>
      <div className="relative overflow-hidden rounded-lg bg-subtle">
        {!fits ? (
          <div className="flex aspect-[4/5] items-center justify-center px-1 text-center text-[10px] text-fg/60">
            Not an image or video
          </div>
        ) : video ? (
          <video
            src={`${url}#t=0.1`}
            muted
            playsInline
            preload="metadata"
            className="aspect-[4/5] w-full object-cover"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={file.name} className="aspect-[4/5] w-full object-cover" />
        )}
        {label ? (
          <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 text-[10px] font-semibold leading-4 text-white">
            {label}
          </span>
        ) : null}
        {video && fits ? (
          <span className="absolute bottom-1 left-1 rounded bg-black/70 p-1 text-white">
            <Film size={11} aria-hidden />
          </span>
        ) : null}
        <button
          type="button"
          aria-label={`Remove ${file.name}`}
          disabled={disabled}
          onClick={onRemove}
          className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white hover:bg-black disabled:opacity-50"
        >
          <X size={12} aria-hidden />
        </button>
      </div>
      <p className="mt-1 truncate text-[11px] text-fg/70" title={file.name}>
        {file.name}
      </p>
      <p className="text-[10px] text-fg/45">{fileSize(file.size)}</p>
    </div>
  );
}

function fileSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** How the chosen files turn into posts. */
type Mode = "separate" | "carousel";

const MODES: { value: Mode; label: string; hint: string; icon: typeof Layers }[] = [
  {
    value: "separate",
    label: "Separate posts",
    hint: "Each image is a post, each video is a reel",
    icon: ImageIcon,
  },
  {
    value: "carousel",
    label: "One carousel",
    hint: "All images and videos in a single post",
    icon: Layers,
  },
];

const isMedia = (file: File) => fileFitsKind(file, "carousel");

/**
 * Adds posts. As separate posts every image becomes an image post and every
 * video a reel; as a carousel all files go into a single post.
 */
export function NewPostDialog({
  campaignId,
  position,
  platformOptions,
  initialFiles,
  onClose,
}: {
  campaignId: string;
  /** Where the first new post goes in the grid (0-based). */
  position: number;
  /** The campaign's platforms, offered per post. */
  platformOptions: string[];
  /** Files dragged onto the campaign before the dialog opened. */
  initialFiles: File[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("separate");
  const [files, setFiles] = useState<File[]>(initialFiles);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [publishDate, setPublishDate] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fitting = files.filter(isMedia);
  const skipped = files.length - fitting.length;
  const videos = fitting.filter((file) => file.type.startsWith("video/")).length;
  const images = fitting.length - videos;
  const postCount = mode === "carousel" ? (fitting.length ? 1 : 0) : fitting.length;
  // Caption and date belong to one post; with several, they are set per post afterwards.
  const onePost = postCount <= 1;

  const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
  const summary =
    fitting.length === 0
      ? null
      : mode === "carousel"
        ? `Creates 1 carousel with ${plural(fitting.length, "slide")}.`
        : `Creates ${[
            images ? plural(images, "image post") : null,
            videos ? plural(videos, "reel") : null,
          ]
            .filter(Boolean)
            .join(" and ")}.`;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!fitting.length) return setError("Add at least one file.");
    if (mode === "carousel" && fitting.length < 2) {
      return setError("A carousel needs at least two slides.");
    }
    setError(null);
    setBusy("Uploading…");
    try {
      await createPosts(createClient(), campaignId, fitting, {
        carousel: mode === "carousel",
        position,
        details: {
          caption: onePost ? caption.trim() || null : null,
          hashtags: onePost ? hashtags.trim() || null : null,
          publish_date: onePost ? publishDate || null : null,
          platforms: platforms.join(", ") || null,
        },
        onStatus: setBusy,
      });
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the post.");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add posts"
      description={busy ?? "Separate posts, or one carousel."}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="How to add the files">
          {MODES.map((item) => {
            const Icon = item.icon;
            const active = item.value === mode;
            return (
              <button
                key={item.value}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={Boolean(busy)}
                onClick={() => {
                  setMode(item.value);
                  setError(null);
                }}
                className={`rounded-xl border p-3 text-left transition ${
                  active ? "border-fg bg-fg/10" : "border-line bg-subtle hover:border-fg/30"
                }`}
              >
                <Icon size={18} aria-hidden className="text-fg" />
                <p className="mt-2 text-sm font-medium text-fg">{item.label}</p>
                <p className="text-[11px] text-fg/55">{item.hint}</p>
              </button>
            );
          })}
        </div>

        <div>
          <DropUpload
            onFiles={(list) => {
              setFiles((current) => [...current, ...Array.from(list)]);
              setError(null);
            }}
            accept="image/*,video/*"
            multiple
            disabled={Boolean(busy)}
            className="flex flex-col items-center rounded-xl border-2 border-dashed border-line px-4 py-5 text-center text-sm text-fg/65 hover:border-fg/30 hover:text-fg"
          >
            Drop images and videos here, or click to choose
          </DropUpload>
          {files.length ? (
            <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {files.map((file, index) => (
                <li key={`${file.name}-${file.size}-${index}`}>
                  <FilePreview
                    file={file}
                    // In a carousel the number is the slide's place.
                    label={mode === "carousel" && isMedia(file) ? String(fitting.indexOf(file) + 1) : null}
                    disabled={Boolean(busy)}
                    onRemove={() => setFiles(files.filter((_, i) => i !== index))}
                  />
                </li>
              ))}
            </ul>
          ) : null}
          {summary ? <p className="mt-2 text-sm font-medium text-fg">{summary}</p> : null}
          {skipped ? (
            <p className="mt-1 text-xs text-amber-700">
              {skipped} faded file{skipped === 1 ? " is" : "s are"} not an image or video and will
              be left out.
            </p>
          ) : null}
        </div>

        {onePost ? (
          <>
            <label className={labelClass}>
              Caption
              <textarea
                rows={3}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Hashtags
              <input
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                placeholder="#brand #campaign"
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Posting date (optional)
              <input
                type="date"
                value={publishDate}
                onChange={(e) => setPublishDate(e.target.value)}
                className={fieldClass}
              />
            </label>
          </>
        ) : (
          <p className="rounded-lg bg-subtle px-3 py-2 text-xs text-fg/65">
            After adding, click each post in the grid to write its caption and posting date.
          </p>
        )}
        {platformOptions.length ? (
          <div className={labelClass}>
            Platforms (optional)
            <PlatformPicker options={platformOptions} value={platforms} onChange={setPlatforms} />
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className={`flex-1 ${secondaryBtnClass}`}>
            Cancel
          </button>
          <button type="submit" disabled={Boolean(busy)} className={`flex-1 ${primaryBtnClass}`}>
            {busy ??
              (postCount > 1 ? `Add ${postCount} posts` : mode === "carousel" ? "Add carousel" : "Add post")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
