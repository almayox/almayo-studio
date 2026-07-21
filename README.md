# Almayo Studio

Personal portfolio + admin CMS on **Next.js + Supabase + Vercel**.

## Structure

```text
almayo-studio/
├── landing-page/              # Public site (port 3000)
├── dashboard/                 # Admin CMS (port 3001)
├── supabase/                  # SQL migrations (run in order)
└── portfolio-old-reference/   # Old repo (reference only, gitignored)
```

## Setup

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a project
2. Open **SQL Editor** and run these files **in order**:
   - `supabase/schema.sql`
   - `supabase/schema_parity.sql`
   - `supabase/schema_contracts.sql`
   - `supabase/schema_campaigns.sql`
   - `supabase/schema_about_depth.sql`
   - `supabase/schema_testimonials.sql`
   - `supabase/schema_updates.sql`
   - `supabase/schema_security.sql`
3. **Authentication → Users** → add your admin user
4. **Authentication → Providers** → disable public signups
5. Add your email to the admin allowlist:
   ```sql
   insert into public.admin_allowlist (email) values ('your@email.com');
   ```
6. Copy **Project URL**, **anon key**, and **service role key** from **Settings → API**

For password reset emails, in **Authentication → URL Configuration**:
- Site URL: `http://localhost:3001` (local) or your dashboard domain
- Redirect URLs: `http://localhost:3001/reset-password`

### 2. Env files

```bash
cp landing-page/.env.example landing-page/.env.local
cp dashboard/.env.example dashboard/.env.local
```

See each `.env.example` for required variables. Both apps need Supabase URL + anon key. Server routes also need `SUPABASE_SERVICE_ROLE_KEY`.

### 3. Run locally

```bash
# Terminal 1: public site
cd landing-page
npm install
npm run dev

# Terminal 2: admin
cd dashboard
npm install
npm run dev -- -p 3001
```

- Landing: http://localhost:3000
- Dashboard: http://localhost:3001

### 4. Add content

1. Sign in at `/login` with your Supabase Auth user
2. Enable 2FA under Settings → Security
3. Create catalogs, projects, clients, and edit site settings

## Deploy

Deploy `landing-page` and `dashboard` as **two separate Vercel projects** from this repo. Set the **Root Directory** for each project (`landing-page` and `dashboard`). Add env vars from each app's `.env.example`.

Point your domain at the landing project when ready. Use a subdomain (e.g. `admin.almayostudio.com`) for the dashboard.
