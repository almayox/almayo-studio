import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Source_Sans_3 } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { getLogoVariants, getSiteSettings, getSocialLinks, resolveNavbarLogos } from "@/lib/data";
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
    title: {
      default: settings.tab_title || settings.site_name,
      template: `%s · ${settings.site_name}`,
    },
    description: settings.hero_tagline,
    icons: settings.favicon_url ? { icon: settings.favicon_url } : undefined,
    openGraph: {
      title: settings.site_name,
      description: settings.hero_tagline,
      images: settings.og_image_url ? [settings.og_image_url] : undefined,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [settings, socialLinks, logos] = await Promise.all([
    getSiteSettings(),
    getSocialLinks(),
    getLogoVariants(),
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
        />
        <WhatsAppButton number={settings.whatsapp_number} />
      </body>
    </html>
  );
}
