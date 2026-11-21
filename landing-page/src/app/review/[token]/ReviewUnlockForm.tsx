"use client";

import { FormEvent, useState } from "react";

export function ReviewUnlockForm({ token, title }: { token: string; title: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function unlock(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/review/${token}/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      setError(data.message || "Incorrect password.");
      setBusy(false);
      return;
    }
    // Content is only rendered by the server once the access cookie is set.
    window.location.reload();
  }

  return (
    <form
      onSubmit={unlock}
      className="mx-auto max-w-md space-y-4 rounded-2xl border border-mist bg-white p-6"
    >
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-navy/45">
          Protected review
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl text-navy">{title}</h1>
        <p className="mt-2 text-sm text-navy/60">Enter the review password to continue.</p>
      </div>
      <label className="block text-sm font-medium text-navy">
        Password
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-mist bg-foam px-3 py-2.5 outline-none ring-navy/30 focus:ring-2"
        />
      </label>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-navy px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        Unlock review
      </button>
    </form>
  );
}
