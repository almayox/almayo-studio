"use client";

import { useEffect, useState } from "react";
import { ProjectBook, type BookPage } from "@/components/ProjectBook";

/**
 * A PDF in the project gallery: its cover at the size of the other media, and
 * the whole book in a full-screen view once it is opened.
 */
export function ProjectBookTile({
  pages,
  title,
  rtl = false,
}: {
  pages: BookPage[];
  title: string;
  /** Written right to left (Arabic): the spine is on the right. */
  rtl?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const cover = pages[0];
  const ratio = cover.width / cover.height;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Open ${title}, ${pages.length} pages`}
        className="group relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-mist transition hover:-translate-y-1 hover:shadow-xl hover:shadow-navy/15"
        // Covers are kept smaller than photos and videos: they are a way in, not the content.
        style={{ aspectRatio: ratio, width: `min(100%, calc(var(--media-row) * 0.72 * ${ratio}))` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cover.url} alt="" className="h-full w-full object-cover" />
        {/* The spine, on the side the book opens from (the top for a wide one). */}
        <span
          aria-hidden
          className={`pointer-events-none absolute from-black/25 to-transparent ${
            ratio >= 1.1
              ? "inset-x-0 top-0 h-6 bg-gradient-to-b"
              : rtl
                ? "inset-y-0 right-0 w-6 bg-gradient-to-l"
                : "inset-y-0 left-0 w-6 bg-gradient-to-r"
          }`}
        />
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-navy/85 to-transparent px-4 pb-3 pt-10 text-left text-xs font-medium text-white">
          <span>{pages.length} pages</span>
          <span className="rounded-full bg-white px-3 py-1 text-navy transition group-hover:bg-navy group-hover:text-white">
            Open book
          </span>
        </span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="fixed inset-0 z-[100] flex flex-col bg-white/95 backdrop-blur-md"
        >
          <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-8">
            <p className="truncate font-[family-name:var(--font-display)] text-lg text-navy">
              {title}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              autoFocus
              className="shrink-0 rounded-full bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy/85"
            >
              Close
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 pb-6 sm:px-8">
            <div className="w-full">
              <ProjectBook pages={pages} title={title} rtl={rtl} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
