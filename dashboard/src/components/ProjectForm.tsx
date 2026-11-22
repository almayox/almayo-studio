"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DropUpload } from "@/components/DropUpload";
import { RichTextEditor } from "@/components/RichTextEditor";
import { SortableMediaGrid } from "@/components/SortableMediaGrid";
import { VideoFramePicker } from "@/components/VideoFramePicker";
import {
  fieldClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/ui/PageChrome";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { createClient } from "@/lib/supabase/client";
import { isPdf, pdfToPageImages, type PdfPage } from "@/lib/pdfPages";
import { parseYouTubeLink, youTubeThumbnail } from "@/lib/youtube";
import { GLB_MIME } from "@/lib/fileScan";
import { isGlbFile, uploadStatusLabel, uploadStudioFile, type UploadPhase } from "@/lib/upload";
import { CropPositionDialog } from "@/components/CropPositionDialog";
import { ModelThumbnailPicker } from "@/components/ModelThumbnailPicker";
import type { Catalog, Client, Project, ProjectMedia } from "@/lib/types";
import { slugify } from "@/lib/types";

type Props = {
  catalogs: Catalog[];
  clients?: Client[];
  project?: Project;
  media?: ProjectMedia[];
  /** Preselect a client when opened from a client's page. */
  initialClientId?: string;
  /** Status of the latest contract linked to this project, if any. */
  contractStatus?: string | null;
};

type PendingMedia = {
  tempId: string;
  url: string;
  media_type: string;
  mime_type: string | null;
  poster_url?: string | null;
  pages?: PdfPage[] | null;
  rtl?: boolean | null;
  group_key?: string | null;
  poster_position?: string | null;
  post_type?: ProjectMedia["post_type"];
};

/** A file or link ready to become a project_media row. */
type UploadedItem = {
  url: string;
  media_type: string;
  mime_type: string | null;
  pages?: PdfPage[];
  rtl?: boolean;
  poster_url?: string;
};

/** The columns a project_media row gets beyond the basics, only when they are set. */
function extraColumns(item: {
  poster_url?: string | null;
  pages?: PdfPage[] | null;
  rtl?: boolean | null;
  group_key?: string | null;
  poster_position?: string | null;
  post_type?: string | null;
}) {
  return {
    ...(item.poster_position ? { poster_position: item.poster_position } : {}),
    ...(item.poster_url ? { poster_url: item.poster_url } : {}),
    ...(item.pages ? { pages: item.pages } : {}),
    ...(item.rtl ? { rtl: true } : {}),
    ...(item.group_key ? { group_key: item.group_key } : {}),
    ...(item.post_type ? { post_type: item.post_type } : {}),
  };
}

const DISPLAY_STYLES = [
  { value: "gallery", label: "Standard gallery", hint: "Images and videos in rows, each in its own shape." },
  { value: "social", label: "Social media grid", hint: "A profile with a grid of three. Tap a post to open it; carousels swipe." },
  { value: "video", label: "Video player", hint: "A large player with a red progress bar and the other videos listed beside it." },
];

const SETUP_NEEDED =
  "The database needs an update first: run supabase/schema_project_video_thumbnails.sql in Supabase.";

export function ProjectForm({
  catalogs,
  clients = [],
  project,
  media = [],
  initialClientId = "",
  contractStatus = null,
}: Props) {
  const router = useRouter();
  const isEdit = Boolean(project);

  const [title, setTitle] = useState(project?.title ?? "");
  const [slug, setSlug] = useState(project?.slug ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [tags, setTags] = useState(project?.tags ?? "");
  const [techStack, setTechStack] = useState(project?.tech_stack ?? "");
  const [catalogId, setCatalogId] = useState(project?.catalog_id ?? "");
  const [clientId, setClientId] = useState(project?.client_id ?? initialClientId);
  const [contractRequired, setContractRequired] = useState(
    project?.contract_required ?? false,
  );
  const [isVisible, setIsVisible] = useState(project?.is_visible ?? true);
  const [isFeatured, setIsFeatured] = useState(project?.is_featured ?? false);
  const [sortOrder, setSortOrder] = useState(project?.sort_order ?? 0);
  const [displayStyle, setDisplayStyle] = useState(project?.display_style || "gallery");
  const [youTubeLink, setYouTubeLink] = useState("");
  const [gallery, setGallery] = useState<ProjectMedia[]>(media);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase | null>(null);
  /** Progress wording for a PDF, which the usual phases do not describe. */
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  /** The video whose thumbnail is being chosen. */
  const [posterFor, setPosterFor] = useState<ProjectMedia | null>(null);
  /** The item whose crop is being chosen, with the picture to show for it. */
  const [cropFor, setCropFor] = useState<{ id: string; image: string; position?: string | null } | null>(
    null,
  );

  const autoSlug = useMemo(() => slugify(title), [title]);

  async function uploadFile(file: File) {
    return uploadStudioFile(file, {
      bucket: "project-media",
      folder: "projects",
      onProgress: (pct) => setUploadProgress(pct),
      onPhase: setUploadPhase,
    });
  }

  /** A PDF becomes one image per page; the PDF file itself is not stored. */
  async function uploadPdf(file: File): Promise<UploadedItem> {
    setUploadNote("Reading PDF…");
    const { pages: images, rtl } = await pdfToPageImages(file, (done, total) =>
      setUploadNote(`Preparing page ${Math.min(done + 1, total)} of ${total}…`),
    );
    const pages: PdfPage[] = new Array(images.length);
    let next = 0;
    let done = 0;
    setUploadNote(`Uploading page 1 of ${images.length}…`);
    async function worker() {
      while (next < images.length) {
        const index = next;
        next += 1;
        const image = images[index];
        const url = await uploadStudioFile(image.file, {
          bucket: "project-media",
          folder: "projects",
          optimizeImage: false,
        });
        pages[index] = { url, width: image.width, height: image.height };
        done += 1;
        setUploadNote(`Uploaded ${done} of ${images.length} pages…`);
      }
    }
    await Promise.all(Array.from({ length: Math.min(3, images.length) }, worker));
    return { url: pages[0].url, media_type: "pdf", mime_type: "application/pdf", pages, rtl };
  }

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return [] as UploadedItem[];

    setUploading(true);
    setUploadProgress(null);
    setUploadPhase("uploading");
    setError(null);
    try {
      const uploaded: UploadedItem[] = [];
      for (const file of list) {
        if (isPdf(file)) {
          uploaded.push(await uploadPdf(file));
          setUploadNote(null);
          continue;
        }
        const url = await uploadFile(file);
        if (isGlbFile(file)) {
          uploaded.push({ url, media_type: "model", mime_type: GLB_MIME });
          continue;
        }
        uploaded.push({
          url,
          media_type: file.type.startsWith("video/") ? "video" : "image",
          // A large video is stored as a compressed MP4, whatever it was.
          mime_type: /\.mp4$/i.test(url) ? "video/mp4" : file.type || null,
        });
      }
      return uploaded;
    } finally {
      setUploading(false);
      setUploadProgress(null);
      setUploadPhase(null);
      setUploadNote(null);
    }
  }

  /** Adds uploaded files or links to the gallery: saved at once on an existing project. */
  async function addMedia(uploaded: UploadedItem[]) {
    if (!uploaded.length) return;
    if (project?.id) {
      const supabase = createClient();
      const created: ProjectMedia[] = [];
      for (const [index, item] of uploaded.entries()) {
        const { data, error: insertError } = await supabase
          .from("project_media")
          .insert({
            project_id: project.id,
            url: item.url,
            media_type: item.media_type,
            mime_type: item.mime_type,
            sort_order: gallery.length + index,
            ...extraColumns(item),
          })
          .select("*")
          .single();
        if (insertError) throw insertError;
        created.push(data as ProjectMedia);
      }
      setGallery((prev) => [...prev, ...created]);
      return;
    }
    setPendingMedia((prev) => [
      ...prev,
      ...uploaded.map((item) => ({
        tempId: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        ...item,
      })),
    ]);
  }

  function showMediaError(err: unknown, fallback: string) {
    const message = (err as { message?: string } | null)?.message || fallback;
    setError(/pages|rtl|group_key|poster_url|poster_position|post_type/.test(message) ? SETUP_NEEDED : message);
  }

  async function onGalleryFiles(files: FileList) {
    try {
      await addMedia(await uploadFiles(files));
    } catch (err) {
      showMediaError(err, "Upload failed");
    }
  }

  /** A YouTube video is kept as its link; the site shows YouTube's own player. */
  async function addYouTubeLink() {
    const parsed = parseYouTubeLink(youTubeLink);
    if (!parsed) {
      setError("That does not look like a YouTube link. Paste the video's address from YouTube.");
      return;
    }
    setError(null);
    try {
      await addMedia([
        {
          url: youTubeLink.trim(),
          media_type: "youtube",
          mime_type: null,
          poster_url: youTubeThumbnail(parsed.id),
        },
      ]);
      setYouTubeLink("");
    } catch (err) {
      showMediaError(err, "The link could not be added");
    }
  }

  /** Changes fields on gallery items, on screen and, for a saved project, in the database. */
  async function patchMedia(patches: { id: string; values: Partial<ProjectMedia> }[]) {
    if (!patches.length) return;
    const byId = new Map(patches.map((patch) => [patch.id, patch.values]));
    if (!project?.id) {
      setPendingMedia((prev) =>
        prev.map((item) => (byId.has(item.tempId) ? { ...item, ...byId.get(item.tempId) } : item)),
      );
      return;
    }
    const supabase = createClient();
    const results = await Promise.all(
      patches.map((patch) =>
        supabase.from("project_media").update(patch.values).eq("id", patch.id),
      ),
    );
    const failed = results.find((result) => result.error);
    if (failed?.error) return showMediaError(failed.error, "Saving failed");
    setGallery((prev) =>
      prev.map((item) => (byId.has(item.id) ? { ...item, ...byId.get(item.id) } : item)),
    );
  }

  /** Joins an item to the post before it (a carousel), or takes it out again. */
  function toggleJoin(item: ProjectMedia) {
    const index = displayGallery.findIndex((entry) => entry.id === item.id);
    const previous = displayGallery[index - 1];
    if (!previous) return;
    if (item.group_key && item.group_key === previous.group_key) {
      // Leaving: this item, and what followed it in the post, become a post of their own.
      const rest = displayGallery
        .slice(index + 1)
        .filter((entry) => entry.group_key === item.group_key);
      const key = rest.length ? crypto.randomUUID() : null;
      void patchMedia(
        [item, ...rest].map((entry) => ({ id: entry.id, values: { group_key: key } })),
      );
      return;
    }
    const key = previous.group_key || crypto.randomUUID();
    void patchMedia(
      [previous, item].map((entry) => ({ id: entry.id, values: { group_key: key } })),
    );
  }

  /** Steps a post's kind: automatic, then post, carousel, reel, and back to automatic. */
  function cyclePostType(item: ProjectMedia) {
    const order = [null, "post", "carousel", "reel"] as const;
    const next = order[(order.indexOf(item.post_type ?? null) + 1) % order.length];
    void patchMedia([{ id: item.id, values: { post_type: next } }]);
  }

  /** Saves a video's own thumbnail image. */
  async function savePoster(item: ProjectMedia, posterUrl: string) {
    if (item.id.startsWith("temp-")) {
      setPendingMedia((prev) =>
        prev.map((m) => (m.tempId === item.id ? { ...m, poster_url: posterUrl } : m)),
      );
      return;
    }
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("project_media")
      .update({ poster_url: posterUrl })
      .eq("id", item.id);
    if (updateError) {
      setError(
        /poster_url/.test(updateError.message)
          ? "The database needs an update before video thumbnails can be saved: run supabase/schema_project_video_thumbnails.sql in Supabase."
          : updateError.message,
      );
      return;
    }
    setGallery((prev) => prev.map((m) => (m.id === item.id ? { ...m, poster_url: posterUrl } : m)));
  }

  async function removeGalleryItem(id: string) {
    if (id.startsWith("temp-")) {
      setPendingMedia((prev) => prev.filter((item) => item.tempId !== id));
      return;
    }

    const supabase = createClient();
    await supabase.from("project_media").delete().eq("id", id);
    setGallery((prev) => prev.filter((item) => item.id !== id));
  }

  async function persistReorder(items: ProjectMedia[]) {
    setGallery(items);
    if (!project?.id) return;
    const supabase = createClient();
    await Promise.all(
      items.map((item, index) =>
        supabase.from("project_media").update({ sort_order: index }).eq("id", item.id),
      ),
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!clientId) {
      setError("Choose the client this project belongs to. Add the client first if it is new.");
      return;
    }
    setLoading(true);

    try {
      const supabase = createClient();
      const payload = {
        title,
        slug: slug || autoSlug,
        description: description || null,
        tags: tags || null,
        tech_stack: techStack || null,
        catalog_id: catalogId || null,
        client_id: clientId,
        contract_required: contractRequired,
        thumbnail_url: coverUrl,
        thumbnail_position: coverPosition,
        is_visible: isVisible,
        is_featured: isFeatured,
        sort_order: Number(sortOrder) || 0,
        // Left out while it is the default, so saving works before the database update.
        ...(displayStyle !== "gallery" || project?.display_style
          ? { display_style: displayStyle }
          : {}),
      };

      if (isEdit && project) {
        const { error: updateError } = await supabase
          .from("projects")
          .update(payload)
          .eq("id", project.id);
        if (updateError) throw updateError;
        router.push("/projects");
        router.refresh();
        return;
      }

      const { data, error: insertError } = await supabase
        .from("projects")
        .insert(payload)
        .select("id")
        .single();
      if (insertError) throw insertError;

      if (pendingMedia.length) {
        const { error: mediaError } = await supabase.from("project_media").insert(
          pendingMedia.map((item, index) => ({
            project_id: data.id,
            url: item.url,
            media_type: item.media_type,
            mime_type: item.mime_type,
            sort_order: index,
            ...extraColumns(item),
          })),
        );
        if (mediaError) throw mediaError;
      }

      router.push(`/projects/${data.id}`);
      router.refresh();
    } catch (err) {
      const message = (err as { message?: string } | null)?.message || "Save failed";
      setError(/display_style|pages|rtl|group_key|poster_url|post_type/.test(message) ? SETUP_NEEDED : message);
      setLoading(false);
    }
  }

  const displayGallery: ProjectMedia[] = project?.id
    ? gallery
    : pendingMedia.map((item) => ({
        id: item.tempId,
        project_id: "pending",
        url: item.url,
        media_type: item.media_type,
        mime_type: item.mime_type,
        caption: null,
        poster_url: item.poster_url ?? null,
        pages: item.pages ?? null,
        rtl: item.rtl ?? false,
        group_key: item.group_key ?? null,
        poster_position: item.poster_position ?? null,
        post_type: item.post_type ?? null,
        sort_order: 0,
      }));

  // The picture shown for the project in lists: the first image, or the first
  // video's thumbnail, in gallery order.
  const coverItem = displayGallery.find((item) =>
    ["video", "youtube", "model"].includes(item.media_type) ? item.poster_url : item.url,
  );
  const coverUrl = coverItem
    ? ((["video", "youtube", "model"].includes(coverItem.media_type)
        ? coverItem.poster_url
        : coverItem.url) ?? null)
    : null;
  const coverPosition = coverItem?.poster_position || "50% 50%";

  // On a saved project the gallery saves as it changes, so the cover follows it.
  // Starts from what is on screen, so only a change to the gallery writes.
  const savedCover = useRef(`${coverUrl} ${coverPosition}`);
  const projectId = project?.id;
  useEffect(() => {
    if (!projectId || savedCover.current === `${coverUrl} ${coverPosition}`) return;
    savedCover.current = `${coverUrl} ${coverPosition}`;
    void createClient()
      .from("projects")
      .update({ thumbnail_url: coverUrl, thumbnail_position: coverPosition })
      .eq("id", projectId);
  }, [projectId, coverUrl, coverPosition]);

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-fg sm:col-span-2">
          Title
          <input
            required
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!project) setSlug(slugify(e.target.value));
            }}
            className={fieldClass}
          />
        </label>

        <label className="block text-sm font-medium text-fg">
          Slug
          <input
            required
            value={slug || autoSlug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            className={fieldClass}
          />
        </label>

        <label className="block text-sm font-medium text-fg">
          Catalog
          <SearchSelect
            value={catalogId}
            onChange={setCatalogId}
            placeholder="Search catalogs…"
            emptyLabel="Uncategorized"
            options={catalogs.map((catalog) => ({
              value: catalog.id,
              label: catalog.name,
            }))}
          />
        </label>

        <label className="block text-sm font-medium text-fg">
          Client <span className="text-red-700">*</span>
          <SearchSelect
            value={clientId}
            onChange={setClientId}
            placeholder="Search clients…"
            emptyLabel="Choose a client"
            options={(clients || []).map((client) => ({
              value: client.id,
              label: client.name,
            }))}
          />
          {clients.length === 0 ? (
            <span className="mt-1.5 block text-xs font-normal text-fg/60">
              No clients yet.{" "}
              <Link href="/clients" className="font-medium text-fg underline">
                Add a client
              </Link>{" "}
              first.
            </span>
          ) : null}
        </label>

        <div className="rounded-xl border border-line bg-subtle/60 p-4 sm:col-span-2">
          <label className="flex items-start gap-3 text-sm font-medium text-fg">
            <input
              type="checkbox"
              checked={contractRequired}
              onChange={(e) => setContractRequired(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-line"
            />
            <span>
              This project needs a contract
              <span className="block text-xs font-normal text-fg/60">
                Internal only, never shown on the public site. Leave off for work done without
                a contract.
              </span>
            </span>
          </label>
          {contractRequired ? (
            <p className="mt-3 flex flex-wrap items-center gap-2 pl-7 text-xs text-fg/70">
              <span
                className={`rounded-full px-2.5 py-1 font-medium ${
                  contractStatus === "signed"
                    ? "bg-emerald-50 text-emerald-700"
                    : contractStatus
                      ? "bg-amber-50 text-amber-700"
                      : "bg-red-50 text-red-700"
                }`}
              >
                {contractStatus ? `Contract: ${contractStatus}` : "No contract yet"}
              </span>
              {project?.id ? (
                <Link
                  href={`/contracts?project=${project.id}&client=${clientId}${contractStatus ? "" : "&new=1"}`}
                  className="font-medium text-fg underline"
                >
                  {contractStatus ? "Open contracts" : "Create contract"}
                </Link>
              ) : (
                <span>Save the project, then create its contract.</span>
              )}
            </p>
          ) : null}
        </div>

        <label className="block text-sm font-medium text-fg sm:col-span-2">
          Description
          <div className="mt-1.5">
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Project story, outcomes, stack…"
            />
          </div>
        </label>

        <label className="block text-sm font-medium text-fg">
          Tags (comma separated)
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className={fieldClass}
          />
        </label>

        <label className="block text-sm font-medium text-fg">
          Tech stack
          <input
            value={techStack}
            onChange={(e) => setTechStack(e.target.value)}
            className={fieldClass}
          />
        </label>

        <label className="block text-sm font-medium text-fg">
          Sort order
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            className={fieldClass}
          />
        </label>

        <div className="flex flex-wrap items-end gap-5 pb-2">
          <label className="inline-flex items-center gap-2 text-sm text-fg">
            <input
              type="checkbox"
              checked={isVisible}
              onChange={(e) => setIsVisible(e.target.checked)}
            />
            Published
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-fg">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
            />
            Featured
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface p-5">
        <p className="text-sm font-medium text-fg">Look of the project page</p>
        <p className="mt-1 text-xs text-fg/50">
          How visitors see this project. A PDF always opens as a book, whichever you choose.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {DISPLAY_STYLES.map((style) => (
            <label
              key={style.value}
              className={`cursor-pointer rounded-lg border p-3 transition ${
                displayStyle === style.value
                  ? "border-fg bg-fg/5"
                  : "border-line hover:border-fg/30"
              }`}
            >
              <input
                type="radio"
                name="display-style"
                value={style.value}
                checked={displayStyle === style.value}
                onChange={() => setDisplayStyle(style.value)}
                className="sr-only"
              />
              <span className="block text-sm font-medium text-fg">{style.label}</span>
              <span className="mt-1 block text-xs text-fg/55">{style.hint}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-line bg-surface p-5">
        <div>
          <p className="text-sm font-medium text-fg">Project media</p>
          <p className="mt-1 text-xs text-fg/50">
            Drag & drop to upload. Drag to reorder. “Set video thumbnail” chooses the image shown on that video before it plays. The first item is the picture shown for this project in lists.{displayStyle === "social" ? " In the social grid every item is a post; press “Join previous” to make a carousel." : ""}
          </p>
        </div>

        <SortableMediaGrid
          items={displayGallery}
          onReorder={(items) => {
            if (project?.id) {
              void persistReorder(items);
            } else {
              setPendingMedia(
                items.map((item) => ({
                  tempId: item.id,
                  url: item.url,
                  media_type: item.media_type,
                  mime_type: item.mime_type,
                  poster_url: item.poster_url,
                  pages: item.pages,
                  rtl: item.rtl,
                  group_key: item.group_key,
                  poster_position: item.poster_position,
                  post_type: item.post_type,
                })),
              );
            }
          }}
          onDelete={(id) => {
            void removeGalleryItem(id);
          }}
          onEditPoster={setPosterFor}
          onCrop={(item) => {
            const image =
              item.media_type === "image" || item.media_type === "pdf" ? item.url : item.poster_url;
            if (image) setCropFor({ id: item.id, image, position: item.poster_position });
          }}
          grouping={displayStyle === "social"}
          onToggleJoin={toggleJoin}
          onCyclePostType={cyclePostType}
          onToggleRtl={(item) => void patchMedia([{ id: item.id, values: { rtl: !item.rtl } }])}
        />

        <DropUpload
          onFiles={onGalleryFiles}
          accept="image/*,video/*,application/pdf,.glb,model/gltf-binary"
          multiple
          disabled={uploading}
          className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-subtle px-4 py-10 text-center transition hover:border-fg/30"
        >
          <span className="font-[family-name:var(--font-display)] text-lg text-fg">
            {uploading
              ? uploadNote || uploadStatusLabel(uploadPhase, uploadProgress)
              : "Drop files here or click to upload"}
          </span>
          <span className="text-xs text-fg/50">PNG, JPG, WEBP, MP4, MOV, PDF, GLB. Multiple files supported. Videos over 25 MB are compressed for you; a PDF is shown as a book and a GLB as a 3D model visitors can turn.</span>
        </DropUpload>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="url"
            inputMode="url"
            value={youTubeLink}
            onChange={(e) => setYouTubeLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              void addYouTubeLink();
            }}
            placeholder="Or paste a YouTube link (video or Short)"
            aria-label="YouTube link"
            className={fieldClass}
          />
          <button
            type="button"
            onClick={() => void addYouTubeLink()}
            disabled={!youTubeLink.trim()}
            className={`shrink-0 ${secondaryBtnClass}`}
          >
            Add YouTube video
          </button>
        </div>

        {cropFor ? (
          <CropPositionDialog
            imageUrl={cropFor.image}
            position={cropFor.position}
            onClose={() => setCropFor(null)}
            onSave={(value) => {
              void patchMedia([{ id: cropFor.id, values: { poster_position: value } }]);
              setCropFor(null);
            }}
          />
        ) : null}
        {posterFor?.media_type === "model" ? (
          <ModelThumbnailPicker
            modelUrl={posterFor.url}
            onClose={() => setPosterFor(null)}
            onPicked={(url) => {
              void savePoster(posterFor, url);
              setPosterFor(null);
              // Straight on to choosing which part of the new picture shows.
              setCropFor({ id: posterFor.id, image: url });
            }}
          />
        ) : null}
        {posterFor && posterFor.media_type !== "model" ? (
          <VideoFramePicker
            videoUrl={posterFor.url}
            onClose={() => setPosterFor(null)}
            onPicked={(url) => {
              void savePoster(posterFor, url);
              setPosterFor(null);
              // Straight on to choosing which part of the new picture shows.
              setCropFor({ id: posterFor.id, image: url });
            }}
          />
        ) : null}
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={loading || uploading}
          className={primaryBtnClass}
        >
          {loading
            ? "Saving…"
            : uploading
              ? uploadNote || uploadStatusLabel(uploadPhase, uploadProgress)
              : "Save project"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/projects")}
          className={secondaryBtnClass}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
