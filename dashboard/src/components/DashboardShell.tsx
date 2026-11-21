"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ExternalLink,
  FileSignature,
  FileText,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  Megaphone,
  Menu,
  Receipt,
  Settings,
  Shapes,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { SignOutButton } from "@/components/SignOutButton";
import { publicSiteUrl } from "@/lib/siteUrl";

type NavItem = { href: string; label: string; icon: LucideIcon };

/** Counts shown beside sidebar links, keyed by the link's href. */
type NavBadges = Record<string, number>;

/** Sidebar groups, in the order the studio's work flows. */
const NAV_GROUPS: NavItem[][] = [
  [{ href: "/overview", label: "Overview", icon: LayoutDashboard }],
  [
    { href: "/projects", label: "Projects", icon: FolderKanban },
    { href: "/catalogs", label: "Catalogs", icon: Shapes },
    { href: "/clients", label: "Clients", icon: Users },
    { href: "/leads", label: "Leads", icon: Inbox },
  ],
  [
    { href: "/quotations", label: "Quotations", icon: FileText },
    { href: "/invoices", label: "Invoices", icon: Receipt },
    { href: "/expenses", label: "Expenses", icon: Wallet },
  ],
  [
    { href: "/contracts", label: "Contracts", icon: FileSignature },
    { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  ],
  [{ href: "/settings", label: "Settings", icon: Settings }],
];

const navLinkClass =
  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition";

function Brand() {
  return (
    <div className="flex items-center gap-3 px-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white font-[family-name:var(--font-display)] text-sm font-bold text-canvas">
        A
      </span>
      <span className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-fg">
        Almayo
      </span>
    </div>
  );
}

function SidebarNav({
  email,
  badges,
  onNavigate,
}: {
  email?: string;
  badges: NavBadges;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full min-h-0 flex-col px-3 py-5">
      <Brand />

      <nav className="mt-6 flex-1 space-y-4 overflow-y-auto" aria-label="Main">
        {NAV_GROUPS.map((group) => (
          <div key={group[0].href} className="space-y-0.5">
            {group.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`${navLinkClass} ${
                    active
                      ? "bg-muted text-fg"
                      : "text-fg/60 hover:bg-subtle hover:text-fg"
                  }`}
                >
                  <Icon size={16} strokeWidth={1.75} aria-hidden />
                  {label}
                  {badges[href] ? (
                    <span
                      className="ml-auto rounded-full bg-fg px-1.5 text-[11px] font-semibold leading-5 text-canvas"
                      aria-label={`${badges[href]} with new client activity`}
                    >
                      {badges[href]}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mt-4 space-y-0.5 border-t border-line pt-4">
        <a
          href={publicSiteUrl()}
          target="_blank"
          rel="noreferrer"
          className={`${navLinkClass} text-fg/60 hover:bg-subtle hover:text-fg`}
        >
          <ExternalLink size={16} strokeWidth={1.75} aria-hidden />
          View site
        </a>
        <SignOutButton variant="sidebar" className="w-full" />
        {email ? (
          <p className="truncate px-3 pt-2 text-[11px] text-fg/40">{email}</p>
        ) : null}
      </div>
    </div>
  );
}

export function DashboardShell({
  children,
  email,
  badges = {},
}: {
  children: React.ReactNode;
  email?: string;
  badges?: NavBadges;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="glass sticky top-0 hidden h-screen w-60 shrink-0 border-r border-line lg:block">
        <SidebarNav email={email} badges={badges} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-line bg-panel shadow-2xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 rounded-lg p-2 text-fg/60 hover:bg-subtle hover:text-fg"
            >
              <X size={18} aria-hidden />
            </button>
            <SidebarNav email={email} badges={badges} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="glass sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="rounded-lg border border-line p-2 text-fg"
          >
            <Menu size={18} aria-hidden />
          </button>
          <Brand />
          <span className="w-9" aria-hidden />
        </div>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-8 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
