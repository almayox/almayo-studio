import { SettingsTabs } from "@/components/SettingsTabs";
import { createClient } from "@/lib/supabase/server";
import type {
  AboutContent,
  ContactDetails,
  LogoVariant,
  ResumeFile,
  SiteSettings,
  SocialLink,
} from "@/lib/types";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const [
    { data: settings },
    { data: about },
    { data: contact },
    { data: resume },
    { data: socialLinks },
    { data: logos },
  ] = await Promise.all([
    supabase.from("site_settings").select("*").limit(1).maybeSingle(),
    supabase.from("about_content").select("*").limit(1).maybeSingle(),
    supabase.from("contact_details").select("*").limit(1).maybeSingle(),
    supabase
      .from("resume_file")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("social_links").select("*").order("sort_order", { ascending: true }),
    supabase.from("logo_variants").select("*").order("variant_type", { ascending: true }),
  ]);

  if (!settings || !about || !contact) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <p className="font-medium">Supabase content rows missing</p>
        <p className="mt-2 text-sm">
          Run <code>supabase/schema.sql</code> in your Supabase SQL editor, then refresh.
        </p>
      </div>
    );
  }

  return (
    <SettingsTabs
      settings={settings as SiteSettings}
      about={about as AboutContent}
      contact={contact as ContactDetails}
      resume={(resume as ResumeFile) ?? null}
      socialLinks={(socialLinks as SocialLink[]) ?? []}
      logos={(logos as LogoVariant[]) ?? []}
    />
  );
}
