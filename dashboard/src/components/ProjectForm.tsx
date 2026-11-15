"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DropUpload } from "@/components/DropUpload";
import { RichTextEditor } from "@/components/RichTextEditor";
import { SortableMediaGrid } from "@/components/SortableMediaGrid";
import { ThumbnailPositionPicker } from "@/components/ThumbnailPositionPicker";
import {
  fieldClass,
  labelClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/ui/PageChrome";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { createClient } from "@/lib/supabase/client";
import { uploadStatusLabel, uploadStudioFile, type UploadPhase } from "@/lib/upload";
import type { Catalog, Client, Project, ProjectMedia } from "@/lib/types";
import { slugify } from "@/lib/types";

type Props = {
  catalogs: Catalog[];
  clients?: Client[];
  project?: Project;
  media?: ProjectMedia[];
};

type PendingMedia = {
  tempId: string;
  url: string;
  media_type: string;
  mime_type: string | null;
};

export function ProjectForm({ catalogs, clients = [], project, media = [] }: Props) {
  const router = useRouter();
  const isEdit = Boolean(project);

  const [title, setTitle] = useState(project?.title ?? "");
  const [slug, setSlug] = useState(project?.slug ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [tags, setTags] = useState(project?.tags ?? "");
  const [techStack, setTechStack] = useState(project?.tech_stack ?? "");
  const [catalogId, setCatalogId] = useState(project?.catalog_id ?? "");
  const [clientId, setClientId] = useState(project?.client_id ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState(project?.thumbnail_url ?? "");
  const [thumbnailPosition, setThumbnailPosition] = useState(
    project?.thumbnail_position ?? "50% 50%",
  );
  const [isVisible, setIsVisible] = useState(project?.is_visible ?? true);
  const [isFeatured, setIsFeatured] = useState(project?.is_featured ?? false);
  const [sortOrder, setSortOrder] = useState(project?.sort_order ?? 0);
  const [gallery, setGallery] = useState<ProjectMedia[]>(media);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase | null>(null);

  const autoSlug = useMemo(() => slugify(title), [title]);

  async function uploadFile(file: File) {
    return uploadStudioFile(file, {
      bucket: "project-media",
      folder: "projects",
      onProgress: (pct) => setUploadProgress(pct),
      onPhase: setUploadPhase,
    });
  }

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return [] as { url: string; media_type: string; mime_type: string | null }[];

    setUploading(true);
    setUploadProgress(null);
    setUploadPhase("uploading");
    setError(null);
    try {
      const uploaded = [];
      for (const file of list) {
        const url = await uploadFile(file);
        uploaded.push({
          url,
          media_type: file.type.startsWith("video/") ? "video" : "image",
          mime_type: file.type || null,
        });
      }
      return uploaded;
    } finally {
      setUploading(false);
      setUploadProgress(null);
      setUploadPhase(null);
    }
  }

  async function onGalleryFiles(files: FileList) {
    try {
      const uploaded = await uploadFiles(files);
      if (!uploaded.length) return;

      if (!thumbnailUrl) {
        const firstImage = uploaded.find((u) => u.media_type === "image");
        if (firstImage) setThumbnailUrl(firstImage.url);
      }

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  async function removeGalleryItem(id: string) {
    if (id.startsWith("temp-")) {
      setPendingMedia((prev) => {
        const next = prev.filter((item) => item.tempId !== id);
        const removed = prev.find((item) => item.tempId === id);
        if (removed && thumbnailUrl === removed.url) {
          const fallback = next.find((m) => m.media_type === "image")?.url || "";
          setThumbnailUrl(fallback);
        }
        return next;
      });
      return;
    }

    const supabase = createClient();
    await supabase.from("project_media").delete().eq("id", id);
    setGallery((prev) => {
      const removed = prev.find((item) => item.id === id);
      const next = prev.filter((item) => item.id !== id);
      if (removed && thumbnailUrl === removed.url) {
        const fallback = next.find((m) => m.media_type === "image")?.url || "";
        setThumbnailUrl(fallback);
      }
      return next;
    });
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
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const payload = {
        title,
        slug: slug || autoSlug,
        description: description || null,
        tags: tags || null,
        tech_stack: techStack || null,
        catalog_id: catalogId || null,
        client_id: clientId || null,
        thumbnail_url: thumbnailUrl || null,
        thumbnail_position: thumbnailPosition || "50% 50%",
        is_visible: isVisible,
        is_featured: isFeatured,
        sort_order: Number(sortOrder) || 0,
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
          })),
        );
        if (mediaError) throw mediaError;
      }

      router.push(`/projects/${data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
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
        sort_order: 0,
      }));

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-navy sm:col-span-2">
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

        <label className="block text-sm font-medium text-navy">
          Slug
          <input
            required
            value={slug || autoSlug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            className={fieldClass}
          />
        </label>

        <label className="block text-sm font-medium text-navy">
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

        <label className="block text-sm font-medium text-navy">
          Client
          <SearchSelect
            value={clientId}
            onChange={setClientId}
            placeholder="Search clients…"
            emptyLabel="No client"
            options={(clients || []).map((client) => ({
              value: client.id,
              label: client.name,
            }))}
          />
        </label>

        <label className="block text-sm font-medium text-navy sm:col-span-2">
          Description
          <div className="mt-1.5">
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Project story, outcomes, stack…"
            />
          </div>
        </label>

        <label className="block text-sm font-medium text-navy">
          Tags (comma separated)
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className={fieldClass}
          />
        </label>

        <label className="block text-sm font-medium text-navy">
          Tech stack
          <input
            value={techStack}
            onChange={(e) => setTechStack(e.target.value)}
            className={fieldClass}
          />
        </label>

        <label className="block text-sm font-medium text-navy">
          Sort order
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            className={fieldClass}
          />
        </label>

        <div className="flex flex-wrap items-end gap-5 pb-2">
          <label className="inline-flex items-center gap-2 text-sm text-navy">
            <input
              type="checkbox"
              checked={isVisible}
              onChange={(e) => setIsVisible(e.target.checked)}
            />
            Published
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-navy">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
            />
            Featured
          </label>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-mist bg-white p-5">
        <div>
          <p className="text-sm font-medium text-navy">Project media</p>
          <p className="mt-1 text-xs text-navy/50">
            Drag & drop to upload. Drag an image to reorder. Click ★ to set the thumbnail.
          </p>
        </div>

        <SortableMediaGrid
          items={displayGallery}
          thumbnailUrl={thumbnailUrl}
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
                })),
              );
            }
          }}
          onDelete={(id) => {
            void removeGalleryItem(id);
          }}
          onSetThumbnail={(url) => setThumbnailUrl(url)}
        />

        <DropUpload
          onFiles={onGalleryFiles}
          accept="image/*,video/*"
          multiple
          disabled={uploading}
          className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-mist bg-foam px-4 py-10 text-center transition hover:border-navy/30"
        >
          <span className="font-[family-name:var(--font-display)] text-lg text-navy">
            {uploading
              ? uploadStatusLabel(uploadPhase, uploadProgress)
              : "Drop files here or click to upload"}
          </span>
          <span className="text-xs text-navy/50">PNG, JPG, WEBP, MP4. Multiple files supported.</span>
        </DropUpload>

        {thumbnailUrl ? (
          <div>
            <p className="text-sm font-medium text-navy">Thumbnail preview</p>
            <ThumbnailPositionPicker
              url={thumbnailUrl}
              position={thumbnailPosition}
              onChange={setThumbnailPosition}
            />
            <button
              type="button"
              onClick={() => {
                setThumbnailUrl("");
                setThumbnailPosition("50% 50%");
              }}
              className="mt-2 text-xs text-navy/55 underline hover:text-navy"
            >
              Clear thumbnail
            </button>
          </div>
        ) : (
          <p className="text-sm text-navy/50">
            No thumbnail selected yet. Upload media, then click ★ on one image.
          </p>
        )}
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
              ? uploadStatusLabel(uploadPhase, uploadProgress)
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
