export function whatsappLink(number: string, message?: string) {
  const digits = number.replace(/\D/g, "");
  const text = encodeURIComponent(
    message ?? "Hi Almayo, I'm interested in working with Almayo Studio.",
  );
  return `https://wa.me/${digits}?text=${text}`;
}

/**
 * The year I started working in each field. The site counts the years from
 * these, so the numbers move on by themselves every January.
 */
export const PRACTICE_SINCE = [
  { field: "Graphic design", since: 2014 },
  { field: "Website design", since: 2018 },
  { field: "Photography", since: 2019 },
  { field: "Videography", since: 2022 },
  { field: "Software development", since: 2024 },
] as const;

/** Whole years from the start of `since` to now, never less than 1. */
export function yearsSince(since: number, now: Date = new Date()): number {
  return Math.max(1, now.getFullYear() - since);
}

/** Years since my first design job: the "Years experience" figure. */
export function yearsOfExperience(now: Date = new Date()): number {
  return yearsSince(Math.min(...PRACTICE_SINCE.map((item) => item.since)), now);
}

export const LANGUAGES = [
  { name: "Arabic", level: "Native" },
  { name: "English", level: "Professional working proficiency" },
] as const;

export function parseSkills(skills: string[] | string | null | undefined): string[] {
  if (!skills) return [];
  if (Array.isArray(skills)) return skills;
  try {
    const parsed = JSON.parse(skills);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

export type ExperienceItem = {
  role?: string;
  title?: string;
  company?: string;
  period?: string;
  description?: string;
};

export type CertificationItem = {
  name?: string;
  issuer?: string;
  year?: string;
};

export type ServiceItem = {
  title?: string;
  description?: string;
};

export function parseExperience(value: unknown): ExperienceItem[] {
  if (!value) return [];
  let items: unknown[] = [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      items = Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  } else if (Array.isArray(value)) {
    items = value;
  }
  return items
    .map((item) => item as ExperienceItem)
    .filter((item) => Boolean((item.role || item.title || "").trim()));
}

export function parseCertifications(value: unknown): CertificationItem[] {
  if (!value) return [];
  let items: unknown[] = [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      items = Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  } else if (Array.isArray(value)) {
    items = value;
  }
  return items
    .map((item) => item as CertificationItem)
    .filter((item) => Boolean(item.name?.trim()));
}

export function parseServices(value: unknown): ServiceItem[] {
  if (!value) return [];
  let items: unknown[] = [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      items = Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  } else if (Array.isArray(value)) {
    items = value;
  }
  return items
    .map((item) => item as ServiceItem)
    .filter((item) => Boolean(item.title?.trim()));
}

export const DEFAULT_SERVICES: ServiceItem[] = [
  {
    title: "Brand Identity",
    description:
      "Logo systems, visual language, and brand guidelines that stay consistent from first pitch to daily use.",
  },
  {
    title: "Web & Product",
    description:
      "Marketing sites, product UI, and full-stack builds, usually with Next.js, clear structure, and room to grow.",
  },
  {
    title: "3D Booth Modeling",
    description:
      "Exhibition and event booth concepts with accurate form, materials, and presentation-ready renders.",
  },
  {
    title: "Social & Campaigns",
    description:
      "Campaign visuals and social systems built to hold together across platforms and formats.",
  },
  {
    title: "Motion Design",
    description:
      "Motion for brands, interfaces, and launches, polished enough for clients, light enough to ship.",
  },
];

export type TestimonialItem = {
  quote?: string;
  name?: string;
  role?: string;
  company?: string;
};

export function parseTestimonials(value: unknown): TestimonialItem[] {
  if (!value) return [];
  let items: unknown[] = [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      items = Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  } else if (Array.isArray(value)) {
    items = value;
  }
  return items
    .map((item) => item as TestimonialItem)
    .filter((item) => Boolean(item.quote?.trim() && item.name?.trim()));
}

export const FALLBACK_SETTINGS = {
  id: "fallback",
  site_name: "Almayo Studio",
  tagline: "Graphic Designer & Software Engineer",
  hero_title: "Almayo Studio",
  hero_subtitle: "Graphic Designer & Software Engineer",
  hero_tagline: "Creating beautiful designs and powerful software solutions.",
  countries_served: "3",
  whatsapp_number: "+96560644416",
  tab_title: "Almayo Studio",
  og_image_url: null,
};

export const FALLBACK_ABOUT = {
  id: "fallback",
  bio: "Alemayehu Ibrahim (Almayo) is a graphic designer and software engineer based in Kuwait. Through Almayo Studio he helps brands and teams shape identity, digital products, campaign visuals, and spatial concepts, with clients across Kuwait, Europe, and Ethiopia.\n\nHe works end to end: from the first brief and visual direction to production-ready design systems, websites, and 3D booth presentations. The goal is always the same: work that looks intentional and holds up after launch.",
  profile_photo_url: null,
  skills: [
    "Brand Identity",
    "UI/UX",
    "Web Development",
    "Next.js",
    "Motion Design",
    "3D Modeling",
    "Campaign Design",
  ],
  services: DEFAULT_SERVICES,
  experience: [
    {
      role: "Founder / Designer & Developer",
      company: "Almayo Studio",
      period: "Present",
      description:
        "Running a freelance studio focused on brand systems, digital products, campaigns, and 3D exhibition work for clients in Kuwait and internationally.",
    },
    {
      role: "Graphic Designer & Software Engineer",
      company: "Freelance / Studio collaborations",
      period: "6+ years",
      description:
        "Delivered identity systems, marketing sites, product interfaces, social campaigns, and booth visualizations for startups, agencies, and established brands.",
    },
  ],
  certifications: [],
};

export const FALLBACK_CONTACT = {
  id: "fallback",
  email: "almayo.online@gmail.com",
  location: "Kuwait",
};
