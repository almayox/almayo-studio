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

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getSession().then(({ data }) => {
      setReady(Boolean(data.session));
    });
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy-deep via-navy to-[#163566] px-5">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl shadow-black/20"
      >
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy/45">Admin</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-navy">
          Set new password
        </h1>

        {!ready ? (
          <p className="mt-6 text-sm text-navy/60">
            Open this page from the email reset link. If you already did, wait a moment…
          </p>
        ) : (
          <>
            <label className="mt-8 block text-sm font-medium text-navy">
              New password
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-mist bg-foam px-3 py-2.5 outline-none ring-navy/30 focus:ring-2"
              />
            </label>
            <label className="mt-4 block text-sm font-medium text-navy">
              Confirm password
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-mist bg-foam px-3 py-2.5 outline-none ring-navy/30 focus:ring-2"
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

        <Link href="/login" className="mt-4 block text-center text-sm text-navy/60 hover:text-navy">
          Back to login
        </Link>
      </form>
    </div>
  );
}
