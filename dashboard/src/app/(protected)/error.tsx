"use client";

import { useEffect } from "react";
import { primaryBtnClass } from "@/components/ui/PageChrome";

export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-2xl border border-mist bg-white px-6 py-12 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-xl text-navy">
        Something went wrong
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-navy/60">
        This page could not be loaded. Check your connection and try again.
      </p>
      {error.digest ? (
        <p className="mt-2 text-xs text-navy/40">Reference: {error.digest}</p>
      ) : null}
      <button type="button" onClick={() => reset()} className={`mt-6 ${primaryBtnClass}`}>
        Try again
      </button>
    </div>
  );
}
