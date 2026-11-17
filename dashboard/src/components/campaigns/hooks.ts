"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadStatusLabel, uploadStudioFile, type UploadPhase } from "@/lib/upload";

type SupabaseBrowserClient = ReturnType<typeof createClient>;
type WriteOutcome = { error: { message: string } | null };

/** Reports a problem in the page notice; null clears it. */
export type ReportError = (message: string | null) => void;

/**
 * Runs one database write the way every campaign action does: clear the page
 * notice, run it, then either show the error or reload the data.
 * Resolves to true when the write went through.
 */
export function useCampaignWrite(onError: ReportError) {
  const router = useRouter();

  return async function write(
    action: (supabase: SupabaseBrowserClient) => PromiseLike<WriteOutcome>,
  ): Promise<boolean> {
    onError(null);
    const { error } = await action(createClient());
    if (error) {
      onError(error.message);
      return false;
    }
    router.refresh();
    return true;
  };
}

export type CampaignWrite = ReturnType<typeof useCampaignWrite>;

/**
 * Uploads a file into the campaign's folder, then hands its URL to `work`,
 * which stores it. One upload at a time: every drop zone of the campaign
 * shares `uploading` and `label`.
 */
export function useCampaignUpload(campaignId: string, onError: ReportError) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [phase, setPhase] = useState<UploadPhase | null>(null);

  async function run(
    file: File,
    fallbackMessage: string,
    /** May return a warning to show although the upload itself was kept. */
    work: (url: string, supabase: SupabaseBrowserClient) => Promise<string | void>,
  ) {
    setUploading(true);
    setPhase("uploading");
    onError(null);
    try {
      const url = await uploadStudioFile(file, {
        folder: `campaigns/${campaignId}`,
        onPhase: setPhase,
      });
      const warning = await work(url, createClient());
      if (warning) onError(warning);
      router.refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : fallbackMessage);
    } finally {
      setUploading(false);
      setPhase(null);
    }
  }

  return { uploading, label: uploadStatusLabel(phase), run };
}

export type CampaignUpload = ReturnType<typeof useCampaignUpload>;
