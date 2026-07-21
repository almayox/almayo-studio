"use client";

import { FormEvent, useState } from "react";
import {
  validateContactForm,
  type ContactFormErrors,
} from "@/lib/contactValidation";

export function ContactForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [service, setService] = useState("");
  const [message, setMessage] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ContactFormErrors>({});

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus("loading");
    setError(null);
    setFieldErrors({});

    const payload = {
      fullName,
      email,
      phone,
      service,
      message,
      companyWebsite,
    };

    const clientCheck = validateContactForm(payload);
    if (!clientCheck.ok) {
      setFieldErrors(clientCheck.errors);
      setError(Object.values(clientCheck.errors)[0] ?? "Please fix the highlighted fields.");
      setStatus("error");
      return;
    }

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
        fieldErrors?: ContactFormErrors;
      };

      if (!response.ok) {
        if (data.fieldErrors) setFieldErrors(data.fieldErrors);
        throw new Error(data.message ?? "Could not send message");
      }

      setStatus("success");
      setFullName("");
      setEmail("");
      setPhone("");
      setService("");
      setMessage("");
      setCompanyWebsite("");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not send message");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-800">
        <p className="font-[family-name:var(--font-display)] text-xl">Message sent</p>
        <p className="mt-2 text-sm">Thanks. I will get back to you soon.</p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-4 text-sm font-medium underline"
        >
          Send another
        </button>
      </div>
    );
  }

  const inputClass = (field: keyof ContactFormErrors) =>
    `mt-1.5 w-full rounded-xl border bg-foam px-3 py-2.5 outline-none ring-navy/30 focus:ring-2 ${
      fieldErrors[field] ? "border-red-300" : "border-mist"
    }`;

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-mist bg-white p-6">
      <h2 className="font-[family-name:var(--font-display)] text-xl text-navy">
        Send a message
      </h2>

      <input
        type="text"
        name="company_website"
        value={companyWebsite}
        onChange={(e) => setCompanyWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="pointer-events-none absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      <label className="block text-sm font-medium text-navy">
        Full name
        <input
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          maxLength={100}
          autoComplete="name"
          className={inputClass("fullName")}
        />
        {fieldErrors.fullName ? (
          <span className="mt-1 block text-xs text-red-600">{fieldErrors.fullName}</span>
        ) : null}
      </label>

      <label className="block text-sm font-medium text-navy">
        Email
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={254}
          autoComplete="email"
          inputMode="email"
          className={inputClass("email")}
        />
        {fieldErrors.email ? (
          <span className="mt-1 block text-xs text-red-600">{fieldErrors.email}</span>
        ) : null}
      </label>

      <label className="block text-sm font-medium text-navy">
        Phone
        <input
          required
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          maxLength={20}
          autoComplete="tel"
          inputMode="tel"
          placeholder="+965 0000 0000"
          className={inputClass("phone")}
        />
        {fieldErrors.phone ? (
          <span className="mt-1 block text-xs text-red-600">{fieldErrors.phone}</span>
        ) : null}
      </label>

      <label className="block text-sm font-medium text-navy">
        Service interested
        <input
          value={service}
          onChange={(e) => setService(e.target.value)}
          maxLength={200}
          className={inputClass("service")}
          placeholder="Branding, website, app…"
        />
        {fieldErrors.service ? (
          <span className="mt-1 block text-xs text-red-600">{fieldErrors.service}</span>
        ) : null}
      </label>

      <label className="block text-sm font-medium text-navy">
        Message
        <textarea
          required
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={5000}
          minLength={15}
          className={inputClass("message")}
          placeholder="Tell me about your project, timeline, and goals."
        />
        {fieldErrors.message ? (
          <span className="mt-1 block text-xs text-red-600">{fieldErrors.message}</span>
        ) : (
          <span className="mt-1 block text-xs text-navy/40">At least 15 characters</span>
        )}
      </label>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full rounded-xl bg-navy px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {status === "loading" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
