"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { whatsappLink } from "@/lib/content";
import type { SocialLink } from "@/lib/types";

const AmbientStarsScene = dynamic(
  () => import("@/components/HeroScene").then((m) => m.AmbientStarsScene),
  { ssr: false },
);

export function Footer({
  siteName,
  tagline,
  whatsappNumber,
  socialLinks = [],
}: {
  siteName: string;
  tagline: string;
  whatsappNumber: string;
  socialLinks?: SocialLink[];
}) {
  return (
    <footer className="relative overflow-hidden bg-navy-deep text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(96,145,230,0.18),transparent_48%),radial-gradient(ellipse_at_90%_100%,rgba(40,80,150,0.22),transparent_50%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-90"
      >
        <AmbientStarsScene />
      </div>

      <div className="relative z-10 mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="font-[family-name:var(--font-display)] text-2xl tracking-tight">
            {siteName}
          </p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/60">{tagline}</p>
          <a
            href={whatsappLink(whatsappNumber)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-navy transition hover:bg-white/90"
          >
            WhatsApp Me
          </a>
        </div>
        <div className="grid grid-cols-2 gap-8 text-sm">
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-white/40">
              Explore
            </p>
            <div className="flex flex-col gap-2.5 text-white/75">
              <Link href="/projects" className="hover:text-white">
                Work
              </Link>
              <Link href="/clients" className="hover:text-white">
                Clients
              </Link>
              <Link href="/about" className="hover:text-white">
                About
              </Link>
              <Link href="/resume" className="hover:text-white">
                Resume
              </Link>
              <Link href="/contact" className="hover:text-white">
                Contact
              </Link>
            </div>
          </div>
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-white/40">
              Connect
            </p>
            <div className="flex flex-col gap-2.5 text-white/75">
              <a
                href={whatsappLink(whatsappNumber)}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white"
              >
                WhatsApp
              </a>
              {socialLinks.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white"
                >
                  {link.platform}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="relative z-10 border-t border-white/10 px-5 py-4 text-center text-xs text-white/40 sm:px-6">
        © {new Date().getFullYear()} {siteName}. All rights reserved.
      </div>
    </footer>
  );
}
