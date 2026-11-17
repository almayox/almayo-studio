"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SecuritySettings() {
  const [loading, setLoading] = useState(true);
  const [enrolled, setEnrolled] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshFactors() {
    const supabase = createClient();
    const { data } = await supabase.auth.mfa.listFactors();
    const totp = data?.totp?.find((f) => f.status === "verified");
    setEnrolled(Boolean(totp));
    setFactorId(totp?.id ?? null);
    setLoading(false);
  }

  useEffect(() => {
    // Loads the factor list once on mount; state is set after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshFactors();
  }, []);

  async function startEnroll() {
    setError(null);
    setMessage(null);
    setVerifyCode("");
    const supabase = createClient();

    // A setup that was started but never confirmed leaves an unverified factor
    // behind, which blocks a new one. Clear those first so setup can restart.
    const { data: existing } = await supabase.auth.mfa.listFactors();
    const unfinished = (existing?.all ?? []).filter(
      (f) => f.factor_type === "totp" && f.status !== "verified",
    );
    for (const factor of unfinished) {
      const { error: clearError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (clearError) {
        setError("Could not clear the unfinished setup. Please try again.");
        return;
      }
    }

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Authenticator app",
    });
    if (enrollError) {
      setError(enrollError.message);
      return;
    }
    setFactorId(data.id);
    setQr(data.totp?.qr_code || null);
    setSecret(data.totp?.secret || null);
    setMessage(null);
  }

  async function cancelEnroll() {
    setError(null);
    setMessage(null);
    const supabase = createClient();
    if (factorId) await supabase.auth.mfa.unenroll({ factorId });
    setFactorId(null);
    setQr(null);
    setSecret(null);
    setVerifyCode("");
  }

  async function confirmEnroll() {
    if (!factorId) return;
    setError(null);
    if (!/^\d{6}$/.test(verifyCode.trim())) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });
    if (challengeError) {
      setError(challengeError.message);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: verifyCode.trim(),
    });
    if (verifyError) {
      setError(verifyError.message);
      return;
    }
    setQr(null);
    setSecret(null);
    setVerifyCode("");
    setMessage("Two-factor authentication is enabled.");
    await refreshFactors();
  }

  async function disableMfa() {
    if (!factorId) return;
    setError(null);
    const supabase = createClient();
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
    if (unenrollError) {
      setError(unenrollError.message);
      return;
    }
    setMessage("Two-factor authentication disabled.");
    setFactorId(null);
    setEnrolled(false);
  }

  if (loading) {
    return <p className="text-sm text-fg/60">Loading security settings…</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl text-fg">
          Two-factor authentication
        </h2>
        <p className="mt-1 text-sm text-fg/60">
          Protect your dashboard with a code from an authenticator app (Google Authenticator, 1Password, Authy).
        </p>
      </div>

      {enrolled ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          2FA is enabled on your account.
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          2FA is not enabled yet. We recommend turning it on before adding team members.
        </div>
      )}

      {qr ? (
        <div className="space-y-3 rounded-xl border border-line bg-subtle p-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-fg/70">
            <li>Open your authenticator app and add a new account.</li>
            <li>Scan this QR code, or type the manual key.</li>
            <li>Enter the 6-digit code the app shows, then confirm.</li>
          </ol>
          <p className="text-xs text-fg/60">
            On iPhone Passwords: save this dashboard login first, open it, then choose
            &ldquo;Set Up Verification Code&rdquo;.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="Authenticator QR code" className="h-48 w-48 rounded-lg bg-white p-2" />
          {secret ? (
            <p className="text-xs text-fg/60">
              Manual key: <span className="font-mono text-fg">{secret}</span>
            </p>
          ) : null}
          <label className="block text-sm font-medium text-fg">
            Verification code
            <input
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="control mt-1.5 w-full max-w-xs"
              placeholder="000000"
              inputMode="numeric"
              autoComplete="one-time-code"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={confirmEnroll} className="btn-primary">
              Confirm and enable 2FA
            </button>
            <button type="button" onClick={startEnroll} className="btn-secondary">
              Generate a new code
            </button>
            <button type="button" onClick={cancelEnroll} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {!enrolled && !qr ? (
          <button type="button" onClick={startEnroll} className="btn-primary">
            Enable 2FA
          </button>
        ) : null}
        {enrolled ? (
          <button type="button" onClick={disableMfa} className="btn-secondary">
            Disable 2FA
          </button>
        ) : null}
      </div>

      {message ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>
      ) : null}
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
