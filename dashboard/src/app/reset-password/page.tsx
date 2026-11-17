"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let hasSession = false;

    const markReady = () => {
      if (!active) return;
      hasSession = true;
      setExpired(false);
      setReady(true);
    };

    // The recovery link signs the user in asynchronously, so listen for it
    // as well as checking for a session that already exists.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) markReady();
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) markReady();
    });

    const timer = window.setTimeout(() => {
      if (active && !hasSession) setExpired(true);
    }, 4000);

    return () => {
      active = false;
      window.clearTimeout(timer);
      listener.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      router.replace("/projects");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center app-backdrop px-5">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md glass rounded-2xl border border-line p-8 shadow-2xl shadow-black/40"
      >
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-fg/45">Admin</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-fg">
          Set new password
        </h1>

        {!ready && expired ? (
          <p className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            This reset link has expired or was opened in a different browser.{" "}
            <Link href="/forgot-password" className="font-medium underline">
              Request a new one.
            </Link>
          </p>
        ) : !ready ? (
          <p className="mt-6 text-sm text-fg/60">
            Open this page from the email reset link. If you already did, wait a moment…
          </p>
        ) : (
          <>
            <label className="mt-8 block text-sm font-medium text-fg">
              New password
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="control mt-1.5 w-full "
              />
            </label>
            <label className="mt-4 block text-sm font-medium text-fg">
              Confirm password
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="control mt-1.5 w-full "
              />
            </label>
            {error ? (
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary mt-6 w-full"
            >
              {loading ? "Saving…" : "Update password"}
            </button>
          </>
        )}

        <Link href="/login" className="mt-4 block text-center text-sm text-fg/60 hover:text-fg">
          Back to login
        </Link>
      </form>
    </div>
  );
}
