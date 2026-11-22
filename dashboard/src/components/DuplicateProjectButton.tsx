"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { createClient } from "@/lib/supabase/client";
import type { Project, ProjectMedia } from "@/lib/types";

/** "name-copy", or "name-copy-2", "name-copy-3"… when that is taken. */
function freeSlug(base: string, taken: Set<string>) {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/**
 * Makes a copy of a project with its details and media, saved as a draft so it
 * is not on the public site until it is edited and published. Opens the copy.
 */
export function DuplicateProjectButton({ project }: { project: Project }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDuplicate() {
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    try {
      const baseSlug = `${project.slug}-copy`;
      const [{ data: slugs }, { data: media }] = await Promise.all([
        supabase.from("projects").select("slug").like("slug", `${baseSlug}%`),
        supabase
          .from("project_media")
          .select("*")
          .eq("project_id", project.id)
          .order("sort_order", { ascending: true }),
      ]);

      const { data: created, error } = await supabase
        .from("projects")
        .insert({
          title: `${project.title} (copy)`,
          slug: freeSlug(baseSlug, new Set((slugs || []).map((row) => row.slug as string))),
          description: project.description,
          tech_stack: project.tech_stack,
          tags: project.tags,
          catalog_id: project.catalog_id,
          client_id: project.client_id,
          contract_required: project.contract_required ?? false,
          thumbnail_url: project.thumbnail_url,
          thumbnail_position: project.thumbnail_position,
          is_visible: false,
          is_featured: false,
          sort_order: project.sort_order,
          ...(project.display_style ? { display_style: project.display_style } : {}),
        })
        .select("id")
        .single();
      if (error) throw error;

      const items = (media || []) as ProjectMedia[];
      if (items.length) {
        const { error: mediaError } = await supabase.from("project_media").insert(
          items.map((item) => ({
            project_id: created.id,
            url: item.url,
            media_type: item.media_type,
            mime_type: item.mime_type,
            caption: item.caption,
            sort_order: item.sort_order,
            ...(item.poster_url ? { poster_url: item.poster_url } : {}),
            ...(item.pages ? { pages: item.pages } : {}),
            ...(item.rtl ? { rtl: true } : {}),
            ...(item.poster_position ? { poster_position: item.poster_position } : {}),
            ...(item.group_key ? { group_key: item.group_key } : {}),
            ...(item.post_type ? { post_type: item.post_type } : {}),
          })),
        );
        if (mediaError) throw mediaError;
      }

      router.push(`/projects/${created.id}`);
      router.refresh();
    } catch (caught) {
      window.alert(
        `Could not duplicate the project. ${caught instanceof Error ? caught.message : ""}`.trim(),
      );
      setBusy(false);
    }
  }

  return (
    <ActionButton
      icon={Copy}
      label="Duplicate"
      title={busy ? "Duplicating…" : "Duplicate"}
      disabled={busy}
      onClick={onDuplicate}
    />
  );
}
