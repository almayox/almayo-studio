"use client";

import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/ui/ActionButton";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function DeleteProjectButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();

  async function onDelete() {
    const ok = window.confirm(`Delete “${title}”? This cannot be undone.`);
    if (!ok) return;
    const supabase = createClient();
    await supabase.from("project_media").delete().eq("project_id", id);
    await supabase.from("projects").delete().eq("id", id);
    router.refresh();
  }

  return (
    <ActionButton icon={Trash2} label="Delete" danger onClick={onDelete} />
  );
}
