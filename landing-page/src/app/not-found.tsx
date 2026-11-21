import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, MousePointer2 } from "lucide-react";
import { RequestedPath } from "@/components/RequestedPath";

export const metadata: Metadata = {
  title: "Page not found",
};

const DESTINATIONS = [
  { href: "/", label: "Home", hint: "Start from the beginning" },
  { href: "/catalogs", label: "Work", hint: "Browse my projects" },
  { href: "/contact", label: "Contact", hint: "Tell me what you were looking for" },
];

/** One corner handle of the selected frame. */
function Handle({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`absolute h-2.5 w-2.5 rounded-[2px] border-2 border-accent bg-white ${className}`}
    />
  );
}

export default function NotFound() {
  return (
    <div className="mx-auto max-w-6xl px-5 pb-24 pt-32 sm:px-6 lg:pt-40">
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-navy/15 bg-white px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-navy/60">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
            Error 404
          </p>
          <h1 className="mt-5 font-[family-name:var(--font-display)] text-4xl leading-[1.05] tracking-tight text-navy sm:text-6xl">
            This page never made it off the artboard.
          </h1>
          <p className="mt-5 max-w-md text-lg text-navy/65">
            The link may be out of date, or I moved the page. Nothing is broken on your side.
          </p>

          <ul className="mt-9 divide-y divide-mist border-y border-mist">
            {DESTINATIONS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="group flex items-center justify-between gap-4 py-4 transition hover:pl-2"
                >
                  <span>
                    <span className="block font-[family-name:var(--font-display)] text-lg text-navy">
                      {item.label}
                    </span>
                    <span className="block text-sm text-navy/55">{item.hint}</span>
                  </span>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-navy/15 text-navy transition group-hover:border-navy group-hover:bg-navy group-hover:text-white">
                    <ArrowUpRight size={18} aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* A design-tool canvas with an empty, selected frame, and the request below it. */}
        <div aria-hidden className="overflow-hidden rounded-3xl bg-navy-deep shadow-2xl shadow-navy/20">
          <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="ml-3 truncate font-mono text-xs text-white/45">
              almayostudio / pages / untitled
            </span>
          </div>

          <div className="hero-grid relative px-8 pb-12 pt-14 sm:px-12">
            <p className="mb-2 font-mono text-[11px] text-accent">Frame · 404</p>
            <div className="relative border border-accent">
              <Handle className="-left-1.5 -top-1.5" />
              <Handle className="-right-1.5 -top-1.5" />
              <Handle className="-bottom-1.5 -left-1.5" />
              <Handle className="-bottom-1.5 -right-1.5" />
              <p
                className="select-none py-8 text-center font-[family-name:var(--font-display)] text-[7rem] font-bold leading-none tracking-tighter text-transparent sm:text-[10rem]"
                style={{ WebkitTextStroke: "1.5px rgba(255,255,255,0.55)" }}
              >
                404
              </p>
              <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 rounded bg-accent px-1.5 py-0.5 font-mono text-[10px] font-semibold text-navy-deep">
                0 layers
              </span>
            </div>

            <span className="not-found-cursor absolute bottom-16 right-10 flex items-start sm:right-16">
              <MousePointer2 size={22} className="fill-accent text-accent" />
              <span className="ml-0.5 mt-4 rounded-md rounded-tl-none bg-accent px-2 py-0.5 text-xs font-semibold text-navy-deep">
                Almayo
              </span>
            </span>
          </div>

          <div className="border-t border-white/10 bg-black/25 px-5 py-4 font-mono text-xs leading-relaxed sm:text-sm">
            <p className="text-white/45">
              <span className="text-emerald-300">GET</span>{" "}
              <RequestedPath className="text-white/85" />
            </p>
            <p className="text-white/45">
              <span className="text-red-300">404</span> Not Found{" "}
              <span className="text-white/30">{"// no page is designed for this address"}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
