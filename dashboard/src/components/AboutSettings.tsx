"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { DropUpload } from "@/components/DropUpload";
import { RichTextEditor } from "@/components/RichTextEditor";
import { createClient } from "@/lib/supabase/client";
import { uploadStatusLabel, uploadStudioFile, type UploadPhase } from "@/lib/upload";
import {
  fieldClass,
  labelClass,
  primaryBtnClass,
} from "@/components/ui/PageChrome";
import type { AboutContent } from "@/lib/types";
import { StorageImage } from "@/components/StorageMedia";

type ServiceDraft = { title: string; description: string };
type ExperienceDraft = {
  role: string;
  company: string;
  period: string;
  description: string;
};
type CertDraft = { name: string; issuer: string; year: string };

function padList<T>(items: T[], count: number, empty: () => T): T[] {
  const next = [...items];
  while (next.length < count) next.push(empty());
  return next.slice(0, count);
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

function skillsToText(skills: AboutContent["skills"]) {
  if (Array.isArray(skills)) return skills.join(", ");
  try {
    const parsed = JSON.parse(skills as string);
    if (Array.isArray(parsed)) return parsed.join(", ");
  } catch {
    /* ignore */
  }
  return typeof skills === "string" ? skills : "";
}

function SectionCard({
  title,
  description,
  children,
  onSubmit,
  loading,
  message,
  error,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onSubmit: (e: FormEvent) => void;
  loading: boolean;
  message: string | null;
  error: string | null;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-xl border border-line bg-subtle/30 p-4 sm:p-5"
    >
      <div>
        <h3 className="font-[family-name:var(--font-display)] text-lg text-fg">{title}</h3>
        <p className="mt-0.5 text-sm text-fg/55">{description}</p>
      </div>
      {children}
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      {message ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>
      ) : null}
      <button type="submit" disabled={loading} className={primaryBtnClass}>
        {loading ? "Saving…" : `Save ${title.toLowerCase()}`}
      </button>
    </form>
  );
}

export function AboutSettings({ about }: { about: AboutContent }) {
  const router = useRouter();
  const [bio, setBio] = useState(about.bio);
  const [skills, setSkills] = useState(skillsToText(about.skills));
  const [profileUrl, setProfileUrl] = useState(about.profile_photo_url || "");
  const [services, setServices] = useState<ServiceDraft[]>(parseServices(about.services));
  const [experience, setExperience] = useState<ExperienceDraft[]>(
    parseExperience(about.experience),
  );
  const [certs, setCerts] = useState<CertDraft[]>(parseCerts(about.certifications));

  const [busy, setBusy] = useState<string | null>(null);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase | null>(null);
  const [messages, setMessages] = useState<Record<string, string | null>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  function setMsg(key: string, message: string | null) {
    setMessages((prev) => ({ ...prev, [key]: message }));
    setErrors((prev) => ({ ...prev, [key]: null }));
  }

  function setErr(key: string, error: string | null) {
    setErrors((prev) => ({ ...prev, [key]: error }));
    setMessages((prev) => ({ ...prev, [key]: null }));
  }

  async function saveBio(event: FormEvent) {
    event.preventDefault();
    setBusy("bio");
    setErr("bio", null);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("about_content")
        .update({ bio })
        .eq("id", about.id);
      if (error) throw error;
      setMsg("bio", "Bio saved.");
      router.refresh();
    } catch (err) {
      setErr("bio", err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function saveProfileSection(event: FormEvent) {
    event.preventDefault();
    setBusy("profile");
    setErr("profile", null);
    try {
      const supabase = createClient();
      const skillList = skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const { error } = await supabase
        .from("about_content")
        .update({ skills: skillList, profile_photo_url: profileUrl || null })
        .eq("id", about.id);
      if (error) throw error;
      setMsg("profile", "Profile & skills saved.");
      router.refresh();
    } catch (err) {
      setErr("profile", err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function uploadProfile(files: FileList) {
    const file = files[0];
    if (!file) return;
    setBusy("profile-upload");
    setUploadPhase("compressing");
    setErr("profile", null);
    try {
      const url = await uploadStudioFile(file, {
        folder: "profile",
        maxEdge: 800,
        onPhase: setUploadPhase,
      });
      setProfileUrl(url);
      const supabase = createClient();
      const { error } = await supabase
        .from("about_content")
        .update({ profile_photo_url: url })
        .eq("id", about.id);
      if (error) throw error;
      setMsg("profile", "Profile photo uploaded.");
      router.refresh();
    } catch (err) {
      setErr("profile", err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(null);
      setUploadPhase(null);
    }
  }

  async function saveServices(event: FormEvent) {
    event.preventDefault();
    setBusy("services");
    setErr("services", null);
    try {
      const nextServices = services
        .map((item) => ({
          title: item.title.trim(),
          description: item.description.trim(),
        }))
        .filter((item) => item.title);
      const supabase = createClient();
      const { error } = await supabase
        .from("about_content")
        .update({ services: nextServices })
        .eq("id", about.id);
      if (error) throw error;
      setMsg("services", "Services saved.");
      router.refresh();
    } catch (err) {
      setErr("services", err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function saveExperience(event: FormEvent) {
    event.preventDefault();
    setBusy("experience");
    setErr("experience", null);
    try {
      const nextExperience = experience
        .map((item) => ({
          role: item.role.trim(),
          company: item.company.trim() || undefined,
          period: item.period.trim() || undefined,
          description: item.description.trim() || undefined,
        }))
        .filter((item) => item.role);
      const supabase = createClient();
      const { error } = await supabase
        .from("about_content")
        .update({ experience: nextExperience })
        .eq("id", about.id);
      if (error) throw error;
      setMsg("experience", "Experience saved.");
      router.refresh();
    } catch (err) {
      setErr("experience", err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function saveCerts(event: FormEvent) {
    event.preventDefault();
    setBusy("certs");
    setErr("certs", null);
    try {
      const nextCerts = certs
        .map((item) => ({
          name: item.name.trim(),
          issuer: item.issuer.trim() || undefined,
          year: item.year.trim() || undefined,
        }))
        .filter((item) => item.name);
      const supabase = createClient();
      const { error } = await supabase
        .from("about_content")
        .update({ certifications: nextCerts })
        .eq("id", about.id);
      if (error) throw error;
      setMsg("certs", "Certifications saved.");
      router.refresh();
    } catch (err) {
      setErr("certs", err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl text-fg">About</h2>
        <p className="mt-1 text-sm text-fg/55">
          Each section saves independently. No scrolling to find the right button.
        </p>
      </div>

      <SectionCard
        title="Bio"
        description="Intro paragraph on the About page."
        onSubmit={saveBio}
        loading={busy === "bio"}
        message={messages.bio ?? null}
        error={errors.bio ?? null}
      >
        <textarea
          rows={7}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className={fieldClass}
        />
      </SectionCard>

      <SectionCard
        title="Profile & skills"
        description="Your photo and skill tags on About."
        onSubmit={saveProfileSection}
        loading={busy === "profile"}
        message={messages.profile ?? null}
        error={errors.profile ?? null}
      >
        {profileUrl ? (
          <StorageImage
            src={profileUrl}
            alt="Profile"
            className="h-24 w-24 rounded-2xl object-cover ring-1 ring-line"
          />
        ) : null}
        <DropUpload
          onFiles={uploadProfile}
          accept="image/*"
          disabled={busy === "profile-upload"}
          className="flex flex-col items-center rounded-xl border-2 border-dashed border-line bg-surface px-3 py-5 text-center text-sm text-fg/70"
        >
          {busy === "profile-upload"
            ? uploadStatusLabel(uploadPhase)
            : "Drop profile photo"}
        </DropUpload>
        <label className={labelClass}>
          Skills (comma separated)
          <input value={skills} onChange={(e) => setSkills(e.target.value)} className={fieldClass} />
        </label>
      </SectionCard>

      <SectionCard
        title="What I can do"
        description="Up to 5 services on the About page."
        onSubmit={saveServices}
        loading={busy === "services"}
        message={messages.services ?? null}
        error={errors.services ?? null}
      >
        {services.map((item, index) => (
          <div
            key={index}
            className="space-y-3 rounded-lg border border-line bg-surface p-4"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-fg/45">
              Service {index + 1}
            </p>
            <label className={labelClass}>
              Title
              <input
                value={item.title}
                onChange={(e) =>
                  setServices((prev) =>
                    prev.map((row, i) =>
                      i === index ? { ...row, title: e.target.value } : row,
                    ),
                  )
                }
                className={fieldClass}
              />
            </label>
            <div>
              <p className={labelClass}>Description</p>
              <div className="mt-1.5">
                <RichTextEditor
                  value={item.description}
                  onChange={(html) =>
                    setServices((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, description: html } : row,
                      ),
                    )
                  }
                  placeholder="What this service includes…"
                />
              </div>
            </div>
          </div>
        ))}
      </SectionCard>

      <SectionCard
        title="Experience"
        description="Up to 4 roles for the About page."
        onSubmit={saveExperience}
        loading={busy === "experience"}
        message={messages.experience ?? null}
        error={errors.experience ?? null}
      >
        {experience.map((item, index) => (
          <div
            key={index}
            className="space-y-3 rounded-lg border border-line bg-surface p-4"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-fg/45">
              Role {index + 1}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>
                Role
                <input
                  value={item.role}
                  onChange={(e) =>
                    setExperience((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, role: e.target.value } : row,
                      ),
                    )
                  }
                  className={fieldClass}
                />
              </label>
              <label className={labelClass}>
                Company
                <input
                  value={item.company}
                  onChange={(e) =>
                    setExperience((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, company: e.target.value } : row,
                      ),
                    )
                  }
                  className={fieldClass}
                />
              </label>
            </div>
            <label className={labelClass}>
              Period
              <input
                value={item.period}
                onChange={(e) =>
                  setExperience((prev) =>
                    prev.map((row, i) =>
                      i === index ? { ...row, period: e.target.value } : row,
                    ),
                  )
                }
                placeholder="2022 - Present"
                className={fieldClass}
              />
            </label>
            <div>
              <p className={labelClass}>Description</p>
              <div className="mt-1.5">
                <RichTextEditor
                  value={item.description}
                  onChange={(html) =>
                    setExperience((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, description: html } : row,
                      ),
                    )
                  }
                />
              </div>
            </div>
          </div>
        ))}
      </SectionCard>

      <SectionCard
        title="Certifications"
        description="Optional. Leave blank to hide."
        onSubmit={saveCerts}
        loading={busy === "certs"}
        message={messages.certs ?? null}
        error={errors.certs ?? null}
      >
        {certs.map((item, index) => (
          <div
            key={index}
            className="grid gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-3"
          >
            <label className={`${labelClass} sm:col-span-3`}>
              Name
              <input
                value={item.name}
                onChange={(e) =>
                  setCerts((prev) =>
                    prev.map((row, i) =>
                      i === index ? { ...row, name: e.target.value } : row,
                    ),
                  )
                }
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Issuer
              <input
                value={item.issuer}
                onChange={(e) =>
                  setCerts((prev) =>
                    prev.map((row, i) =>
                      i === index ? { ...row, issuer: e.target.value } : row,
                    ),
                  )
                }
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Year
              <input
                value={item.year}
                onChange={(e) =>
                  setCerts((prev) =>
                    prev.map((row, i) =>
                      i === index ? { ...row, year: e.target.value } : row,
                    ),
                  )
                }
                className={fieldClass}
              />
            </label>
          </div>
        ))}
      </SectionCard>
    </div>
  );
}
