"use client";

import { FormEvent, useState } from "react";
import { clientSignerPayload } from "@/lib/deviceFingerprint";

type Milestone = {
  id: string;
  name: string;
  amount: string | number;
  currency: string;
  duration: string | null;
};

export function ContractSignForm({
  token,
  title,
  terms,
  termsAr,
  milestones,
  alreadySigned,
  signedByName,
  developerSignedName,
  developerSignedAt,
  signerIp,
  signerDeviceInfo,
}: {
  token: string;
  title: string;
  terms: string | null;
  termsAr?: string | null;
  milestones: Milestone[];
  alreadySigned: boolean;
  signedByName: string | null;
  developerSignedName?: string | null;
  developerSignedAt?: string | null;
  signerIp?: string | null;
  signerDeviceInfo?: string | null;
}) {
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!agreed) {
      setError("Please agree to the terms before signing.");
      return;
    }
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch(`/api/contracts/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signedByName: name,
          ...clientSignerPayload(),
        }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) throw new Error(data.message || "Could not sign contract");
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not sign contract");
    }
  }

  const activeTerms = lang === "ar" && termsAr ? termsAr : terms;
  const deviceInfo = parseDeviceInfo(signerDeviceInfo);

  if (alreadySigned || status === "done") {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900">
          <p className="font-[family-name:var(--font-display)] text-2xl">Contract signed</p>
          <p className="mt-2 text-sm">
            Signed by {signedByName || name || "client"}. Thank you.
          </p>
        </div>
        <SignaturesPanel
          developerSignedName={developerSignedName}
          developerSignedAt={developerSignedAt}
          clientName={signedByName || name}
          clientSignedAt={new Date().toISOString()}
          signerIp={signerIp}
          deviceInfo={deviceInfo}
        />
      </div>
    );
  }

  if (!developerSignedAt) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <p className="font-[family-name:var(--font-display)] text-xl">Not ready yet</p>
        <p className="mt-2 text-sm">
          The developer has not signed this contract yet. Please check back later.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-navy/45">Contract</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl text-navy">{title}</h1>
      </div>

      <SignaturesPanel
        developerSignedName={developerSignedName}
        developerSignedAt={developerSignedAt}
      />

      {terms || termsAr ? (
        <section className="rounded-2xl border border-mist bg-white p-6">
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => setLang("en")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                lang === "en" ? "bg-navy text-white" : "bg-foam text-navy/70"
              }`}
            >
              English
            </button>
            {termsAr ? (
              <button
                type="button"
                onClick={() => setLang("ar")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                  lang === "ar" ? "bg-navy text-white" : "bg-foam text-navy/70"
                }`}
              >
                العربية
              </button>
            ) : null}
          </div>
          <h2 className="font-[family-name:var(--font-display)] text-xl text-navy">Terms</h2>
          <div
            className="prose prose-sm mt-4 max-w-none text-navy/75"
            dir={lang === "ar" ? "rtl" : "ltr"}
            dangerouslySetInnerHTML={{ __html: activeTerms || "" }}
          />
        </section>
      ) : null}

      {milestones.length ? (
        <section className="rounded-2xl border border-mist bg-white p-6">
          <h2 className="font-[family-name:var(--font-display)] text-xl text-navy">Milestones</h2>
          <div className="mt-4 space-y-3">
            {milestones.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-4 border-b border-mist pb-3 last:border-0"
              >
                <div>
                  <p className="font-medium text-navy">{item.name}</p>
                  {item.duration ? <p className="text-xs text-navy/50">{item.duration}</p> : null}
                </div>
                <p className="text-sm font-medium text-navy">
                  {Number(item.amount).toFixed(2)} {item.currency}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-mist bg-white p-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl text-navy">Client signature</h2>
        <label className="block text-sm font-medium text-navy">
          Full legal name
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-mist bg-foam px-3 py-2.5 outline-none ring-navy/30 focus:ring-2"
          />
        </label>
        <label className="flex items-start gap-2 text-sm text-navy/80">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1"
          />
          I have read and agree to the terms of this contract.
        </label>
        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded-xl bg-navy px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {status === "loading" ? "Signing…" : "Sign contract"}
        </button>
      </form>
    </div>
  );
}

function parseDeviceInfo(raw: string | null | undefined) {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function SignaturesPanel({
  developerSignedName,
  developerSignedAt,
  clientName,
  clientSignedAt,
  signerIp,
  deviceInfo,
}: {
  developerSignedName?: string | null;
  developerSignedAt?: string | null;
  clientName?: string | null;
  clientSignedAt?: string | null;
  signerIp?: string | null;
  deviceInfo?: Record<string, unknown> | null;
}) {
  return (
    <section className="grid gap-4 rounded-2xl border border-mist bg-white p-6 md:grid-cols-2">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-navy/45">Developer</p>
        <p className="mt-2 font-medium text-navy">
          {developerSignedName || "Almayo Studio"}
        </p>
        <p className="text-sm text-navy/55">
          {developerSignedAt
            ? new Date(developerSignedAt).toLocaleString()
            : "Not signed yet"}
        </p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-navy/45">Client</p>
        <p className="mt-2 font-medium text-navy">{clientName || "Pending"}</p>
        <p className="text-sm text-navy/55">
          {clientSignedAt ? new Date(clientSignedAt).toLocaleString() : "Not signed yet"}
        </p>
        {signerIp ? (
          <p className="mt-1 font-mono text-xs text-navy/45">IP: {signerIp}</p>
        ) : null}
        {deviceInfo ? (
          <ul className="mt-2 space-y-0.5 text-xs text-navy/50">
            {deviceInfo.browser ? <li>Browser: {String(deviceInfo.browser)}</li> : null}
            {deviceInfo.os ? <li>OS: {String(deviceInfo.os)}</li> : null}
            {deviceInfo.device ? <li>Device: {String(deviceInfo.device)}</li> : null}
            {deviceInfo.timezone ? <li>Timezone: {String(deviceInfo.timezone)}</li> : null}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
