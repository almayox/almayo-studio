"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import Link from "next/link";
import { whatsappLink } from "@/lib/content";

const HeroScene = dynamic(
  () => import("@/components/HeroScene").then((m) => m.HeroScene),
  { ssr: false },
);

const reveal = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function Hero({
  siteName,
  subtitle,
  tagline,
  whatsappNumber,
}: {
  siteName: string;
  subtitle: string;
  tagline: string;
  whatsappNumber: string;
}) {
  return (
    <section
      data-navbar-theme="dark"
      className="relative min-h-[100svh] overflow-hidden bg-navy-deep text-white"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_68%_12%,rgba(96,145,230,0.26),transparent_52%),radial-gradient(ellipse_at_12%_85%,rgba(40,80,150,0.3),transparent_48%),linear-gradient(165deg,#06142d_0%,#0a1f44_52%,#10284f_100%)]"
      />
      <HeroScene />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-16 top-[42%] h-[36rem] w-[36rem] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(120,165,235,0.16),transparent_68%)] sm:right-0 sm:h-[44rem] sm:w-[44rem] lg:opacity-35"
        animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.55, 0.3] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-end px-5 pb-20 pt-40 sm:px-6 md:justify-center md:pb-28 md:pt-28">
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.12 } } }}
          className="max-w-2xl"
        >
          <motion.span
            variants={reveal}
            className="mb-5 inline-block rounded-xl bg-white/10 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-white/80"
          >
            Available for Freelance
          </motion.span>
          <motion.h1
            variants={reveal}
            className="font-[family-name:var(--font-display)] text-5xl leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl"
          >
            {siteName}
          </motion.h1>
          <motion.p
            variants={reveal}
            className="mt-3 text-lg font-medium text-white/80 sm:text-xl"
          >
            {subtitle}
          </motion.p>
          <motion.p
            variants={reveal}
            className="mt-5 max-w-xl text-base leading-relaxed text-white/65 sm:text-lg"
          >
            {tagline}
          </motion.p>
          <motion.div variants={reveal} className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/projects"
              className="inline-flex items-center rounded-xl bg-white px-6 py-3 text-sm font-semibold text-navy transition hover:bg-white/90"
            >
              Explore My Work →
            </Link>
            <a
              href={whatsappLink(whatsappNumber)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-xl border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              WhatsApp
            </a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
