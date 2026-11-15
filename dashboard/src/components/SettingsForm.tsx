"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { DropUpload } from "@/components/DropUpload";
import { createClient } from "@/lib/supabase/client";
import { uploadStatusLabel, uploadStudioFile, type UploadPhase } from "@/lib/upload";
import {
  fieldClass,
  labelClass,
  primaryBtnClass,
} from "@/components/ui/PageChrome";
import type { AboutContent, ContactDetails, SiteSettings } from "@/lib/types";

export type SettingsTabId =
  | "general"
  | "browser"
  | "about"
  | "contact"
  | "testimonials";

type TestimonialDraft = {
  quote: string;
  name: string;
  role: string;
  company: string;
};

type ServiceDraft = { title: string; description: string };
type ExperienceDraft = {
  role: string;
  company: string;
  period: string;
  description: string;
};
type CertDraft = { name: string; issuer: string; year: string };

function skillsToText(skills: AboutContent["skills"]) {
  if (Array.isArray(skills)) return skills.join(", ");
  try {
    const parsed = JSON.parse(skills);
    if (Array.isArray(parsed)) return parsed.join(", ");
  } catch {
    /* ignore */
  }
  return typeof skills === "string" ? skills : "";
}

function padList<T>(items: T[], count: number, empty: () => T): T[] {
  const next = [...items];
  while (next.length < count) next.push(empty());
  return next.slice(0, count);
}

function parseExistingTestimonials(value: unknown): TestimonialDraft[] {
  const empty = (): TestimonialDraft => ({
    quote: "",
    name: "",
    role: "",
    company: "",
  });
  let items: TestimonialDraft[] = [];
  if (Array.isArray(value)) {
    items = value.map((item) => {
      const row = item as Partial<TestimonialDraft>;
      return {
        quote: row.quote || "",
        name: row.name || "",
        role: row.role || "",
        company: row.company || "",
      };
    });
  }
  return padList(items, 3, empty);
}

function parseServices(value: unknown): ServiceDraft[] {
  const empty = (): ServiceDraft => ({ title: "", description: "" });
  let items: ServiceDraft[] = [];
  if (Array.isArray(value)) {
    items = value.map((item) => {
      const row = item as Partial<ServiceDraft>;
      return { title: row.title || "", description: row.description || "" };
    });
  }
  return padList(items, 5, empty);
}

function parseExperience(value: unknown): ExperienceDraft[] {
  const empty = (): ExperienceDraft => ({
    role: "",
    company: "",
    period: "",
    description: "",
  });
  let items: ExperienceDraft[] = [];
  if (Array.isArray(value)) {
    items = value.map((item) => {
      const row = item as Partial<ExperienceDraft> & { title?: string };
      return {
        role: row.role || row.title || "",
        company: row.company || "",
        period: row.period || "",
        description: row.description || "",
      };
    });
  }
  return padList(items, 4, empty);
}

function parseCerts(value: unknown): CertDraft[] {
  const empty = (): CertDraft => ({ name: "", issuer: "", year: "" });
  let items: CertDraft[] = [];
  if (Array.isArray(value)) {
    items = value.map((item) => {
      const row = item as Partial<CertDraft>;
      return {
        name: row.name || "",
        issuer: row.issuer || "",
        year: row.year || "",
      };
    });
  }
  return padList(items, 4, empty);
}

function StatusMessages({
  error,
  message,
}: {
  error: string | null;
  message: string | null;
}) {
  return (
    <>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      {message ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}
    </>
  );
}

export function SettingsForm({
  settings,
  about,
  contact,
  tab,
}: {
  settings: SiteSettings;
  about: AboutContent;
  contact: ContactDetails;
  tab: SettingsTabId;
}) {
  const [form, setForm] = useState({
    site_name: settings.site_name,
    tagline: settings.tagline,
    hero_title: settings.hero_title,
    hero_subtitle: settings.hero_subtitle,
    hero_tagline: settings.hero_tagline,
    years_experience: settings.years_experience,
    countries_served: settings.countries_served,
    countries_list: settings.countries_list ?? "Kuwait, EU, Ethiopia",
    whatsapp_number: settings.whatsapp_number,
    tab_title: settings.tab_title ?? "",
    bio: about.bio,
    skills: skillsToText(about.skills),
    email: contact.email,
    phone: contact.phone,
    location: contact.location,
    contact_whatsapp: contact.whatsapp_number,
  });
  const [testimonials, setTestimonials] = useState<TestimonialDraft[]>(
    parseExistingTestimonials(settings.testimonials),
  );
  const [services, setServices] = useState<ServiceDraft[]>(
    parseServices(about.services),
  );
  const [experience, setExperience] = useState<ExperienceDraft[]>(
    parseExperience(about.experience),
  );
  const [certs, setCerts] = useState<CertDraft[]>(
    parseCerts(about.certifications),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [faviconUrl, setFaviconUrl] = useState(settings.favicon_url || "");
  const [faviconBusy, setFaviconBusy] = useState(false);
  const [faviconPhase, setFaviconPhase] = useState<UploadPhase | null>(null);
  const router = useRouter();

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateTestimonial(
    index: number,
    key: keyof TestimonialDraft,
    value: string,
  ) {
    setTestimonials((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    );
  }

  async function saveGeneral(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("site_settings")
        .update({
          site_name: form.site_name,
          tagline: form.tagline,
          hero_title: form.hero_title,
          hero_subtitle: form.hero_subtitle,
          hero_tagline: form.hero_tagline,
          years_experience: form.years_experience,
          countries_served: form.countries_served,
          countries_list: form.countries_list,
          whatsapp_number: form.whatsapp_number,
        })
        .eq("id", settings.id);
      if (updateError) throw updateError;
      setMessage("General settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  async function saveBrowser(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("site_settings")
        .update({
          tab_title: form.tab_title || null,
          favicon_url: faviconUrl || null,
        })
        .eq("id", settings.id);
      if (updateError) throw updateError;
      setMessage("Browser tab settings saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  async function uploadFavicon(files: FileList) {
    const file = files[0];
    if (!file) return;
    setFaviconBusy(true);
    setFaviconPhase("compressing");
    setError(null);
    try {
      const url = await uploadStudioFile(file, {
        folder: "brand",
        maxEdge: 256,
        onPhase: setFaviconPhase,
      });
      setFaviconUrl(url);
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("site_settings")
        .update({ favicon_url: url })
        .eq("id", settings.id);
      if (updateError) throw updateError;
      setMessage("Favicon uploaded.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setFaviconBusy(false);
      setFaviconPhase(null);
    }
  }

  async function saveAbout(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = createClient();
      const skills = form.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const nextServices = services
        .map((item) => ({
          title: item.title.trim(),
          description: item.description.trim(),
        }))
        .filter((item) => item.title);
      const nextExperience = experience
        .map((item) => ({
          role: item.role.trim(),
          company: item.company.trim() || undefined,
          period: item.period.trim() || undefined,
          description: item.description.trim() || undefined,
        }))
        .filter((item) => item.role);
      const nextCerts = certs
        .map((item) => ({
          name: item.name.trim(),
          issuer: item.issuer.trim() || undefined,
          year: item.year.trim() || undefined,
        }))
        .filter((item) => item.name);

      const { error: updateError } = await supabase
        .from("about_content")
        .update({
          bio: form.bio,
          skills,
          services: nextServices,
          experience: nextExperience,
          certifications: nextCerts,
        })
        .eq("id", about.id);
      if (updateError) throw updateError;
      setMessage("About content saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  async function saveContact(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("contact_details")
        .update({
          email: form.email,
          phone: form.phone,
          location: form.location,
          whatsapp_number: form.contact_whatsapp,
        })
        .eq("id", contact.id);
      if (updateError) throw updateError;
      setMessage("Contact details saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  async function saveTestimonials(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = createClient();
      const nextTestimonials = testimonials
        .map((item) => ({
          quote: item.quote.trim(),
          name: item.name.trim(),
          role: item.role.trim() || undefined,
          company: item.company.trim() || undefined,
        }))
        .filter((item) => item.quote && item.name);

      const { error: updateError } = await supabase
        .from("site_settings")
        .update({ testimonials: nextTestimonials })
        .eq("id", settings.id);
      if (updateError) throw updateError;
      setMessage("Testimonials saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  if (tab === "general") {
    return (
      <form onSubmit={saveGeneral} className="space-y-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl text-navy">
            Site & hero
          </h2>
          <p className="mt-1 text-sm text-navy/55">Homepage headline and stats.</p>
        </div>
        {(
          [
            ["site_name", "Site name"],
            ["tagline", "Tagline"],
            ["hero_title", "Hero title"],
            ["hero_subtitle", "Hero subtitle"],
            ["hero_tagline", "Hero tagline"],
            ["years_experience", "Years experience"],
            ["countries_served", "Countries served (count)"],
            ["countries_list", "Countries served (names, comma separated)"],
            ["whatsapp_number", "WhatsApp number"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className={labelClass}>
            {label}
            <input
              value={form[key]}
              onChange={(e) => update(key, e.target.value)}
              className={fieldClass}
            />
          </label>
        ))}
        <StatusMessages error={error} message={message} />
        <button type="submit" disabled={loading} className={primaryBtnClass}>
          {loading ? "Saving…" : "Save general"}
        </button>
      </form>
    );
  }

  if (tab === "browser") {
    return (
      <form onSubmit={saveBrowser} className="space-y-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl text-navy">
            Browser tab
          </h2>
          <p className="mt-1 text-sm text-navy/55">
            Tab title and favicon shown in the browser.
          </p>
        </div>
        <label className={labelClass}>
          Browser tab title
          <input
            value={form.tab_title}
            onChange={(e) => update("tab_title", e.target.value)}
            className={fieldClass}
          />
        </label>
        <div className="rounded-lg border border-mist bg-foam/40 p-4">
          <p className="text-sm font-medium text-navy">Favicon</p>
          {faviconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={faviconUrl} alt="Favicon" className="mt-2 h-10 w-10 object-contain" />
          ) : (
            <p className="mt-1 text-xs text-navy/50">No favicon yet</p>
          )}
          <DropUpload
            onFiles={uploadFavicon}
            accept="image/png,image/jpeg,image/webp,image/x-icon,image/svg+xml"
            disabled={faviconBusy}
            className="mt-3 flex flex-col items-center rounded-xl border-2 border-dashed border-mist bg-white px-3 py-5 text-center text-sm text-navy/70"
          >
            {faviconBusy
              ? uploadStatusLabel(faviconPhase)
              : "Drop favicon (32–256px recommended)"}
          </DropUpload>
        </div>
        <StatusMessages error={error} message={message} />
        <button type="submit" disabled={loading} className={primaryBtnClass}>
          {loading ? "Saving…" : "Save browser tab"}
        </button>
      </form>
    );
  }

  if (tab === "about") {
    return null;
  }

  if (tab === "contact") {
    return (
      <form onSubmit={saveContact} className="space-y-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl text-navy">Contact</h2>
          <p className="mt-1 text-sm text-navy/55">Public contact details on the site.</p>
        </div>
        {(
          [
            ["email", "Email"],
            ["phone", "Phone"],
            ["location", "Location"],
            ["contact_whatsapp", "WhatsApp number"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className={labelClass}>
            {label}
            <input
              value={form[key]}
              onChange={(e) => update(key, e.target.value)}
              className={fieldClass}
            />
          </label>
        ))}
        <StatusMessages error={error} message={message} />
        <button type="submit" disabled={loading} className={primaryBtnClass}>
          {loading ? "Saving…" : "Save contact"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={saveTestimonials} className="space-y-4">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl text-navy">
          Homepage testimonials
        </h2>
        <p className="mt-1 text-sm text-navy/55">
          Up to 3 quotes. Leave blank to hide the section.
        </p>
      </div>
      {testimonials.map((item, index) => (
        <div
          key={index}
          className="space-y-3 rounded-lg border border-mist bg-foam/40 p-4"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-navy/45">
            Quote {index + 1}
          </p>
          <label className={labelClass}>
            Quote
            <textarea
              rows={3}
              value={item.quote}
              onChange={(e) => updateTestimonial(index, "quote", e.target.value)}
              className={fieldClass}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={labelClass}>
              Name
              <input
                value={item.name}
                onChange={(e) => updateTestimonial(index, "name", e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Role
              <input
                value={item.role}
                onChange={(e) => updateTestimonial(index, "role", e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Company
              <input
                value={item.company}
                onChange={(e) => updateTestimonial(index, "company", e.target.value)}
                className={fieldClass}
              />
            </label>
          </div>
        </div>
      ))}
      <StatusMessages error={error} message={message} />
      <button type="submit" disabled={loading} className={primaryBtnClass}>
        {loading ? "Saving…" : "Save testimonials"}
      </button>
    </form>
  );
}
