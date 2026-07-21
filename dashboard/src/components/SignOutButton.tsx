"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton({
  variant = "light",
  className = "",
}: {
  variant?: "light" | "dark";
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
    variant === "dark"
      ? "flex items-center rounded-xl px-3 py-2.5 text-sm text-white/65 transition hover:bg-red-900/30 hover:text-red-200"
      : "rounded-lg border border-navy/15 px-3 py-1.5 text-xs text-navy transition hover:bg-navy/5";

  return (
    <button type="button" onClick={signOut} className={`${base} ${className}`}>
      Sign out
    </button>
  );
}
