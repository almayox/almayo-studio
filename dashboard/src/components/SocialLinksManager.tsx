"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PaginationBar, usePagination } from "@/components/ui/Pagination";
import { createClient } from "@/lib/supabase/client";
import {
  ActionGroup,
  fieldClass,
  primaryBtnClass,
} from "@/components/ui/PageChrome";
import { ActionButton } from "@/components/ui/ActionButton";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import type { SocialLink } from "@/lib/types";

export function SocialLinksManager({
  initialLinks,
  embedded = false,
}: {
  initialLinks: SocialLink[];
  embedded?: boolean;
}) {
  const router = useRouter();
  const [platform, setPlatform] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pagination = usePagination(initialLinks, 10);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const supabase = createClient();
    const { error: insertError } = await supabase.from("social_links").insert({
      platform,
      url,
      is_visible: true,
      sort_order: initialLinks.length,
    });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setPlatform("");
    setUrl("");
    router.refresh();
  }

  async function toggle(link: SocialLink) {
    const supabase = createClient();
    await supabase
      .from("social_links")
      .update({ is_visible: !link.is_visible })
      .eq("id", link.id);
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this social link?")) return;
    const supabase = createClient();
    await supabase.from("social_links").delete().eq("id", id);
    router.refresh();
  }

  return (
    <section className={embedded ? "space-y-4" : "rounded-xl border border-mist bg-white p-5"}>
      <h2 className="font-[family-name:var(--font-display)] text-xl text-navy">
        Social links
      </h2>
      <p className="mt-1 text-sm text-navy/55">Shown in the website footer.</p>

      <div className="mt-4 overflow-hidden rounded-xl border border-mist bg-white">
        {initialLinks.length === 0 ? (
          <p className="p-4 text-sm text-navy/50">No social links yet.</p>
        ) : (
          <>
            <div className="space-y-2 p-4">
              {pagination.pageItems.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-mist px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-navy">{link.platform}</p>
                    <p className="truncate text-xs text-navy/50">{link.url}</p>
                  </div>
                  <ActionGroup>
                    <ActionButton
                      icon={link.is_visible ? EyeOff : Eye}
                      label={link.is_visible ? "Hide" : "Show"}
                      onClick={() => toggle(link)}
                    />
                    <ActionButton
                      icon={Trash2}
                      label="Delete"
                      danger
                      onClick={() => remove(link.id)}
                    />
                  </ActionGroup>
                </div>
              ))}
            </div>
            <PaginationBar
              page={pagination.page}
              pageSize={pagination.pageSize}
              total={pagination.total}
              totalPages={pagination.totalPages}
              rangeStart={pagination.rangeStart}
              rangeEnd={pagination.rangeEnd}
              onPageChange={pagination.goTo}
              onPageSizeChange={pagination.changePageSize}
            />
          </>
        )}
      </div>

      <form onSubmit={onCreate} className="mt-4 grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
        <input
          required
          placeholder="Platform (LinkedIn)"
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className={fieldClass}
        />
        <input
          required
          type="url"
          placeholder="https://..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className={fieldClass}
        />
        <button type="submit" className={primaryBtnClass}>
          Add
        </button>
      </form>
      {error ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
    </section>
  );
}
