import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-32 sm:px-6">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy/45">404</p>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl text-navy sm:text-5xl">
        This page isn’t here
      </h1>
      <p className="mt-4 max-w-xl text-navy/65">
        The link may be out of date, or the page may have moved. Here are a few places to
        pick things up again.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link
          href="/"
          className="rounded-xl bg-navy px-6 py-3 text-sm font-semibold text-white"
        >
          Back to home
        </Link>
        <Link
          href="/catalogs"
          className="rounded-xl border border-navy/15 px-6 py-3 text-sm font-semibold text-navy"
        >
          See my work
        </Link>
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
