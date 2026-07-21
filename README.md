# Almayo Studio

**Developer · Designer · Creative Technologist**

Hi, I'm **Almayo Ibrahim** — I design and build digital products end to end: brand identity, UI/UX, and production-ready web applications. This repository powers my personal portfolio and studio website, **Almayo Studio**.

🌐 **Website:** [almayostudio.com](https://almayostudio.com) *(update when live)*  
📍 **Based in:** Kuwait · Working with clients in Kuwait, EU, and beyond  
📧 **Contact:** [almayo.online@gmail.com](mailto:almayo.online@gmail.com)

---

## About this project

This is not a template — it is my **live portfolio and business platform**, built to showcase work, manage client relationships, and run day-to-day studio operations from one stack.

**Public site** — portfolio, case studies, catalogs, client showcase, contact, resume, and client-facing review/signing flows.

**Admin dashboard** — CMS to manage projects, clients, leads, invoices, expenses, contracts, and social campaigns without touching code.

Companies and recruiters browsing my GitHub can use this repo to see how I think about **design, architecture, security, and shipping real products**.

---

## What I built

### Public portfolio (`landing-page/`)
- Project and catalog galleries with rich media
- Client showcase and about page with live stats
- Contact form with validation and spam protection
- Campaign review portal (password-protected, client approvals)
- Contract signing with audit trail
- Responsive UI with motion and 3D hero scene

### Studio dashboard (`dashboard/`)
- Full CMS for projects, catalogs, clients, and site settings
- CRM: leads pipeline and CSV export
- Invoices with PDF generation, discounts, and payment history
- Expense tracking
- Contract builder with dual signing workflow
- Social campaign manager with review links and asset approvals
- Secure file uploads with type validation and malware scanning
- Two-factor authentication for admin access

### Backend & security (`supabase/`)
- PostgreSQL schema with Row Level Security
- Rate limiting on public APIs
- Admin allowlist and private storage buckets
- Server-side auth for review, contracts, and contact flows

---

## Tech stack

| Layer | Technologies |
|-------|----------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS |
| Animation | Framer Motion, Three.js, React Three Fiber |
| Backend | Supabase (Auth, Postgres, Storage) |
| CMS / Admin | Custom dashboard on Next.js |
| Rich content | TipTap editor |
| PDF | pdf-lib |
| Deploy | Vercel |

---

## Project structure

```text
almayo-studio/
├── landing-page/     # Public portfolio website
├── dashboard/        # Admin CMS
└── supabase/         # Database migrations
```

---

## For recruiters & hiring teams

This repo demonstrates:

- **Full-stack ownership** — from database design to UI polish
- **Product thinking** — not just a static portfolio; includes CRM, invoicing, and client workflows
- **Security awareness** — RLS, rate limits, 2FA, server-side validation, file scanning
- **Design + code** — one person delivering brand, UX, and implementation

**Live demo:** *(add your Vercel URL after deploy)*  
**Resume:** available on the site at `/resume`

---

## Local development

<details>
<summary>Setup instructions (for developers)</summary>

### 1. Supabase

Create a project at [supabase.com](https://supabase.com) and run SQL files in order:

1. `schema.sql`
2. `schema_parity.sql`
3. `schema_contracts.sql`
4. `schema_campaigns.sql`
5. `schema_about_depth.sql`
6. `schema_testimonials.sql`
7. `schema_updates.sql`
8. `schema_security.sql`

### 2. Environment

```bash
cp landing-page/.env.example landing-page/.env.local
cp dashboard/.env.example dashboard/.env.local
```

Fill in Supabase URL, anon key, and service role key.

### 3. Run

```bash
cd landing-page && npm install && npm run dev
cd dashboard && npm install && npm run dev -- -p 3001
```

- Portfolio: http://localhost:3000  
- Dashboard: http://localhost:3001

</details>

---

## Connect

- **GitHub:** [@almayox](https://github.com/almayox)
- **Website:** [almayostudio.com](https://almayostudio.com)
- **Email:** almayo.online@gmail.com

---

© Almayo Ibrahim · Almayo Studio
