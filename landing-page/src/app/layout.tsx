import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Source_Sans_3 } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import {
  getLogoVariants,
  getResume,
  getSiteSettings,
  getSocialLinks,
  resolveNavbarLogos,
} from "@/lib/data";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const display = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const body = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: settings.tab_title || settings.site_name,
      template: `%s · ${settings.site_name}`,
    },
    description: settings.hero_tagline,
    // "./" resolves against each route's own path, so the home page gets "/"
    // and inner pages get their own canonical instead of inheriting the home URL.
    alternates: { canonical: "./" },
    // Icons and the link-preview image come from the static file conventions
    // (icon.png, apple-icon.png, opengraph-image.tsx).
    openGraph: {
      title: settings.site_name,
      description: settings.hero_tagline,
      url: "./",
      siteName: settings.site_name,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: settings.site_name,
      description: settings.hero_tagline,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [settings, socialLinks, logos, resume] = await Promise.all([
    getSiteSettings(),
    getSocialLinks(),
    getLogoVariants(),
    getResume().catch(() => null),
  ]);
  const navbarLogos = resolveNavbarLogos(logos);

  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-foam text-ink">
        <Navbar
          siteName={settings.site_name}
          logoOnDark={navbarLogos.onDark}
          logoOnLight={navbarLogos.onLight}
        />
        <main className="flex-1">{children}</main>
        <Footer
          siteName={settings.site_name}
          tagline={settings.tagline}
          whatsappNumber={settings.whatsapp_number}
          socialLinks={socialLinks}
          hasResume={Boolean(resume?.file_url)}
        />
        <WhatsAppButton number={settings.whatsapp_number} />
      </body>
    </html>
  );
}
