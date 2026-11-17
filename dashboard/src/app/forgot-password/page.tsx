"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (resetError) throw resetError;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
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
          Forgot password
        </h1>
        <p className="mt-2 text-sm text-fg/60">
          We’ll email you a link to reset your password.
        </p>

        {sent ? (
          <div className="mt-6 rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
            Check your inbox for the reset link. Then open it to set a new password.
          </div>
        ) : (
          <>
            <label className="mt-8 block text-sm font-medium text-fg">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
              {loading ? "Sending…" : "Send reset link"}
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
