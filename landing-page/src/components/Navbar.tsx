"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const links = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About Me" },
  { href: "/catalogs", label: "Work" },
  { href: "/clients", label: "Clients" },
];

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      {open ? (
        <path
          d="M6 6l12 12M18 6L6 18"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M4 7h16M4 12h16M4 17h16"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

export function Navbar({
  siteName,
  logoOnDark,
  logoOnLight,
}: {
  siteName: string;
  logoOnDark?: string | null;
  logoOnLight?: string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const intersectingRef = useRef<Set<Element>>(new Set());

  useEffect(() => {
    setOpen(false);
    setIsDark(true);
    intersectingRef.current = new Set();

    const targets = document.querySelectorAll('[data-navbar-theme="dark"]');
    if (!targets.length) {
      setIsDark(false);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) intersectingRef.current.add(entry.target);
          else intersectingRef.current.delete(entry.target);
        });
        setIsDark(intersectingRef.current.size > 0);
      },
      { root: null, rootMargin: "-64px 0px -85% 0px", threshold: 0 },
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [pathname]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const logoUrl = isDark
    ? logoOnDark || logoOnLight
    : logoOnLight || logoOnDark;

  return (
    <header className="fixed inset-x-0 top-4 z-50 px-4 sm:top-6">
      <div
        className={`mx-auto max-w-4xl rounded-full border shadow-lg backdrop-blur-md transition-colors duration-300 ${
          isDark ? "border-white/20 bg-white/10" : "border-black/5 bg-white/70"
        }`}
      >
        <div className="flex h-14 items-center justify-between gap-2 px-2 sm:px-3">
          <Link
            href="/"
            className={`flex shrink-0 items-center rounded-full px-3 py-2 transition-colors duration-300 ${
              isDark ? "hover:bg-white/10" : "hover:bg-navy/5"
            }`}
          >
            {logoUrl ? (
              <span
                className="relative block overflow-hidden"
                style={{ height: 28, width: 120 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoUrl}
                  alt={siteName || "Almayo"}
                  className="absolute inset-0 h-full w-full object-contain object-left"
                  style={{ maxHeight: 28, maxWidth: 120 }}
                />
              </span>
            ) : (
              <span
                className={`font-[family-name:var(--font-display)] text-lg font-bold tracking-tight ${
                  isDark ? "text-white" : "text-navy"
                }`}
              >
                {siteName || "Almayo"}
              </span>
            )}
          </Link>

          <nav className="hidden items-center gap-0.5 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3.5 py-2.5 text-sm transition-colors duration-300 ${
                  isActive(link.href)
                    ? isDark
                      ? "font-semibold text-white"
                      : "font-semibold text-navy"
                    : isDark
                      ? "font-medium text-white/70 hover:bg-white/10 hover:text-white"
                      : "font-medium text-navy/55 hover:bg-navy/5 hover:text-navy"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/contact"
              className={`ml-1.5 rounded-full border px-5 py-2.5 text-sm font-semibold transition-colors duration-300 ${
                isDark
                  ? "border-white/20 bg-white/10 text-white hover:bg-white/20"
                  : "border-transparent bg-navy text-white hover:bg-navy/90"
              }`}
            >
              Hire Me
            </Link>
          </nav>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={`rounded-full p-3 transition-colors duration-300 md:hidden ${
              isDark
                ? "text-white hover:bg-white/10"
                : "text-navy hover:bg-black/5"
            }`}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            <MenuIcon open={open} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className={`mx-auto mt-2 max-w-4xl overflow-hidden rounded-2xl border shadow-lg backdrop-blur-md md:hidden ${
              isDark
                ? "border-white/20 bg-navy/95 text-white"
                : "border-black/5 bg-white/95 text-navy"
            }`}
          >
            <nav className="flex flex-col gap-1 px-3 py-3">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`rounded-xl px-4 py-3.5 text-sm transition-colors ${
                    isActive(link.href)
                      ? isDark
                        ? "font-semibold text-white"
                        : "font-semibold text-navy"
                      : isDark
                        ? "font-medium text-white/70 hover:bg-white/10 hover:text-white"
                        : "font-medium text-navy/60 hover:bg-foam hover:text-navy"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/contact"
                onClick={() => setOpen(false)}
                className={`mt-2 rounded-full border px-4 py-3.5 text-center text-sm font-semibold ${
                  isDark
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-transparent bg-navy text-white"
                }`}
              >
                Hire Me
              </Link>
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
