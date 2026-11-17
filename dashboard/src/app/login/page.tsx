"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function UnauthorizedNotice() {
  const searchParams = useSearchParams();
  if (searchParams.get("error") !== "unauthorized") return null;
  return (
    <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      This account is not authorised to use the dashboard.
    </p>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
        router.replace("/login/mfa");
      } else {
        router.replace("/projects");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center app-backdrop px-5">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md glass rounded-2xl border border-line p-8 shadow-2xl shadow-black/40"
      >
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-fg/45">
          Admin
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-fg">
          Almayo Studio
        </h1>
        <p className="mt-2 text-sm text-fg/60">Sign in to manage portfolio content.</p>

        <Suspense fallback={null}>
          <UnauthorizedNotice />
        </Suspense>

        <label className="mt-8 block text-sm font-medium text-fg">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="control mt-1.5 w-full "
            placeholder="you@email.com"
          />
        </label>

        <label className="mt-4 block text-sm font-medium text-fg">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="control mt-1.5 w-full "
            placeholder="••••••••"
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
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <Link
          href="/forgot-password"
          className="mt-4 block text-center text-sm text-fg/60 hover:text-fg"
        >
          Forgot password?
        </Link>
      </form>
    </div>
  );
}
