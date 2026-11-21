"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
