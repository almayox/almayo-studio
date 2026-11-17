"use client";

import { useState } from "react";
import { AboutSettings } from "@/components/AboutSettings";
import { BrandAssetsManager } from "@/components/BrandAssetsManager";
import { ResumeUpload } from "@/components/ResumeUpload";
import { SettingsForm, type SettingsTabId } from "@/components/SettingsForm";
import { SecuritySettings } from "@/components/SecuritySettings";
import { SocialLinksManager } from "@/components/SocialLinksManager";
import { PageHeader } from "@/components/ui/PageChrome";
import type {
  AboutContent,
  ContactDetails,
  LogoVariant,
  ResumeFile,
  SiteSettings,
  SocialLink,
} from "@/lib/types";

type TabId = SettingsTabId | "about" | "brand" | "social" | "security";

const TABS: { id: TabId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "browser", label: "Browser Tab" },
  { id: "about", label: "About" },
  { id: "contact", label: "Contact" },
  { id: "social", label: "Social" },
  { id: "brand", label: "Brand" },
  { id: "testimonials", label: "Testimonials" },
  { id: "security", label: "Security" },
];

export function SettingsTabs({
  settings,
  about,
  contact,
  resume,
  socialLinks,
  logos,
}: {
  settings: SiteSettings;
  about: AboutContent;
  contact: ContactDetails;
  resume: ResumeFile | null;
  socialLinks: SocialLink[];
  logos: LogoVariant[];
}) {
  const [tab, setTab] = useState<TabId>("general");

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Site content, brand assets, and contact details."
      />

      <div className="mb-6 flex flex-wrap gap-1 rounded-xl bg-subtle p-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === item.id
                ? "bg-muted text-fg"
                : "text-fg/55 hover:text-fg"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-line bg-surface p-5 sm:p-6">
        {tab === "security" ? (
          <SecuritySettings />
        ) : tab === "social" ? (
          <SocialLinksManager initialLinks={socialLinks} embedded />
        ) : tab === "brand" ? (
          <BrandAssetsManager
            settings={settings}
            logos={logos}
            compact
            embedded
          />
        ) : tab === "about" ? (
          <div className="space-y-6">
            <AboutSettings about={about} />
            <div className="border-t border-line pt-6">
              <ResumeUpload resume={resume} embedded />
            </div>
          </div>
        ) : (
          <SettingsForm
            settings={settings}
            contact={contact}
            tab={tab}
          />
        )}
      </div>
    </div>
  );
}
