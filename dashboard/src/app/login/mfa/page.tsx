"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function MfaLoginPage() {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function prepare() {
      const supabase = createClient();
      const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
      if (factorError) {
        setError(factorError.message);
        return;
      }
      const totp = factors?.totp?.find((f) => f.status === "verified");
      if (!totp) {
        router.replace("/projects");
        return;
      }
      setFactorId(totp.id);
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totp.id,
      });
      if (challengeError) {
        setError(challengeError.message);
        return;
      }
      setChallengeId(challenge.id);
    }
    prepare();
  }, [router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!factorId || !challengeId) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code: code.trim(),
    });
    if (verifyError) {
      setError(verifyError.message);
      setLoading(false);
      return;
    }
    router.replace("/projects");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center app-backdrop px-5">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md glass rounded-2xl border border-line p-8 shadow-2xl shadow-black/40"
      >
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-fg/45">
          Two-factor authentication
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-fg">
          Verify your identity
        </h1>
        <p className="mt-2 text-sm text-fg/60">
          Enter the 6-digit code from your authenticator app.
        </p>

        <label className="mt-8 block text-sm font-medium text-fg">
          Authentication code
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="control mt-1.5 w-full tracking-[0.3em] "
            placeholder="000000"
          />
        </label>

        {error ? (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        <button type="submit" disabled={loading || !challengeId} className="btn-primary mt-6 w-full">
          {loading ? "Verifying…" : "Verify and continue"}
        </button>
      </form>
    </div>
  );
}
