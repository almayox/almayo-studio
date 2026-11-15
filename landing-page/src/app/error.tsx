"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
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
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-32 sm:px-6">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy/45">
        Something went wrong
      </p>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl text-navy sm:text-5xl">
        This page didn’t load
      </h1>
      <p className="mt-4 max-w-xl text-navy/65">
        That’s a problem on my side, not yours. Try again, and if it keeps happening
        please let me know.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-xl bg-navy px-6 py-3 text-sm font-semibold text-white"
        >
          Try again
        </button>
        <Link
          href="/contact"
          className="rounded-xl border border-navy/15 px-6 py-3 text-sm font-semibold text-navy"
        >
          Contact me
        </Link>
      </div>
    </div>
  );
}
