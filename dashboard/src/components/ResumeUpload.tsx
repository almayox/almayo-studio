"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DropUpload } from "@/components/DropUpload";
import { createClient } from "@/lib/supabase/client";
import { uploadStudioFile } from "@/lib/upload";
import type { ResumeFile } from "@/lib/types";
import { StorageLink } from "@/components/StorageMedia";

export function ResumeUpload({
  resume,
  embedded = false,
}: {
  resume: ResumeFile | null;
  embedded?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onFiles(files: FileList) {
    const file = files[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const publicUrl = await uploadStudioFile(file, {
        folder: "resume",
        optimizeImage: false,
      });

      if (resume?.id) {
        const supabase = createClient();
        const { error: updateError } = await supabase
          .from("resume_file")
          .update({ file_url: publicUrl, original_name: file.name })
          .eq("id", resume.id);
        if (updateError) throw updateError;
      } else {
        const supabase = createClient();
        const { error: insertError } = await supabase.from("resume_file").insert({
          file_url: publicUrl,
          original_name: file.name,
        });
        if (insertError) throw insertError;
      }

      setMessage("Resume uploaded.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className={embedded ? "" : "rounded-xl border border-line bg-surface p-5"}>
      <h2 className="font-[family-name:var(--font-display)] text-xl text-fg">Resume PDF</h2>
      <p className="mt-1 text-sm text-fg/55">
        Shown on the public /resume page for download.
      </p>
      {resume?.file_url ? (
        <StorageLink
          href={resume.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm text-fg underline"
        >
          {resume.original_name || "Current resume"}
        </StorageLink>
      ) : (
        <p className="mt-3 text-sm text-fg/55">No resume uploaded yet.</p>
      )}
      <DropUpload
        onFiles={onFiles}
        accept="application/pdf"
        disabled={uploading}
        className="mt-4 flex flex-col items-center rounded-xl border-2 border-dashed border-line bg-subtle px-4 py-6 text-center text-sm text-fg/70"
      >
        {uploading ? "Uploading…" : "Drop PDF or click to upload"}
      </DropUpload>
      {error ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      {message ? (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}
    </section>
  );
}
