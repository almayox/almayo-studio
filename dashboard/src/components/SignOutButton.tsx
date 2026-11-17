"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton({
  variant = "button",
  className = "",
}: {
  /** "sidebar" matches the sidebar links; "button" is a small outlined button. */
  variant?: "button" | "sidebar";
  className?: string;
}) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const base =
    variant === "sidebar"
      ? "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-fg/60 transition hover:bg-red-50 hover:text-red-700"
      : "rounded-lg border border-line px-3 py-1.5 text-xs text-fg transition hover:bg-subtle";

  return (
    <button type="button" onClick={signOut} className={`${base} ${className}`}>
      {variant === "sidebar" ? <LogOut size={16} strokeWidth={1.75} aria-hidden /> : null}
      Sign out
    </button>
  );
}
