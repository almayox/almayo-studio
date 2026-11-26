import type { NextConfig } from "next";


const isDev = process.env.NODE_ENV !== "production";

function hostOf(url: string | undefined) {
  try {
    return url ? new URL(url).hostname : null;
  } catch {
    return null;
  }
}
const supabaseHost = hostOf(process.env.NEXT_PUBLIC_SUPABASE_URL) ?? "**.supabase.co";

// Next.js needs inline scripts for hydration data; everything else is same-origin.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https://*.supabase.co",
  "font-src 'self' data:",
  // blob: lets the 3D viewer read the textures packed inside a model file.
  `connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co${isDev ? " ws:" : ""}`,
  "worker-src 'self' blob:",
  // YouTube's player, for project videos added as a YouTube link.
  "frame-src https://www.youtube-nocookie.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75, 85],
    // Uploaded files never change (unique names), so optimised copies can be kept a month.
    minimumCacheTTL: 2678400,
    // Only this project's own public files may go through the image optimiser.
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHost,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
