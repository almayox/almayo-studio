# Almayo Studio: guide for Claude

Portfolio and studio platform, live at https://almayostudio.com. Two Next.js apps share one Supabase project.

## Layout

| Folder | What it is | Live at | Dev port |
|---|---|---|---|
| `landing-page/` | Public site: projects, catalogs, clients, about, contact, resume, client review (`/review/[token]`), contract signing (`/contract/[token]`) | almayostudio.com | 3000 |
| `dashboard/` | Admin CMS behind login: projects, catalogs, clients, leads, invoices, quotations, expenses, contracts, campaigns, settings | dashboard.almayostudio.com | 3001 |
| `supabase/` | SQL files, run by hand in the Supabase SQL Editor | | |
| `portfolio-old-reference/` | Old site, ignored by git. Do not edit. | | |

Both apps: Next.js 16 (App Router), React 19, TypeScript strict, Tailwind 4, Supabase (`@supabase/ssr`). Each app has its own `package.json`, `src/app`, `src/components`, `src/lib`. There is no shared package: a type or helper needed by both (for example `ProjectMedia` in `src/lib/types.ts`) is kept in both apps and must be changed in both.

## Working rules

- **Never commit or push.** Leave changes in the working tree; the owner reviews the diff and commits. Give a one-line commit message when asked.
- **The owner deploys** (`npm run deploy` inside each app folder) and **runs the SQL files** in Supabase. After a change, say which SQL file to run again and which app to deploy.
- **SQL files must be safe to run again** (`add column if not exists`, `drop policy if exists` then `create policy`). Add columns to the existing file for that feature instead of making a new file for each change.
- **The dashboard cannot be tested behind login** (never enter the owner's password). Say plainly which parts were not tested.
- **Do not kill a `next dev` the owner is running.** Use the preview servers in `.claude/launch.json` (`landing`, `dashboard`).
- **Temporary test pages** (for example a sample page under `landing-page/src/app/`) are deleted after use, and `.next/dev/types` is cleared.
- The repository is public. No secrets, client contact details or private notes in any committed file.
- No planning or analysis documents unless asked.

## Checks before saying a change is done

Run in the app that changed:

```bash
npx tsc --noEmit
```

```bash
npx eslint src --quiet
```

```bash
npm run build
```

## Data and storage

- Storage buckets: `project-media` is public (portfolio media, stable URLs, long cache). `studio-files` is private (receipts, contracts, campaign files) and is always read through signed URLs (`src/lib/storage.ts`, `StorageMedia.tsx` in the dashboard).
- Admin access: Supabase sign-ups are off; policies use `public.is_admin()`, which reads the admin allowlist. Dashboard auth is checked in `dashboard/src/proxy.ts` and again in `app/(protected)/layout.tsx`.
- Public pages read only public columns (see `landing-page/src/lib/data.ts`); client email, phone and address are not readable anonymously.
- Business rules: every project belongs to a client; a quotation converts to an invoice, never the reverse; an invoice takes part payments until paid in full.

## Project media (the part that changes most)

Table `project_media`, one row per file of a project. Main files:

- Dashboard: `components/ProjectForm.tsx` (form, saving, `patchMedia`), `SortableMediaGrid.tsx` (tiles and their buttons), `CropPositionDialog.tsx`, `VideoFramePicker.tsx`, `ModelThumbnailPicker.tsx`, `lib/upload.ts`.
- Site: `components/projectMedia.ts` (turns rows into posts and items), `SocialGrid.tsx`, `ProjectImage.tsx`, `ProjectVideo.tsx`, `ProjectBook.tsx` (PDF), `ModelViewer.tsx` (3D), `app/projects/[slug]/page.tsx`.

Conventions:

- **Post and card tiles are 3:4** everywhere (posts are 1080×1440): social grid, campaign tiles, the review page, project cards, the crop dialog.
- **Crop** is stored as a CSS object-position string, `"x% y%"`, in `project_media.poster_position`, and copied to `projects.thumbnail_position` for the project card. It works for images, PDF covers and video posters.
- **Posts** are files that share a `group_key`. Settings for the whole post are stored on its first item.
- **Post type** is `project_media.post_type`: `post`, `carousel`, `reel`, or empty for automatic (worked out from the files). Read in `toShowPosts` in `projectMedia.ts`.
- **Gallery images keep their own shape.** `ProjectImage` measures the image and sizes the tile from the CSS variable `--media-row`; it does not crop.
- **Uploads**: images are shrunk in the browser to at most 1920 px on the long side (WebP). Wide banners should be exported at about 2400 px or more so they stay sharp. 3D models are `.glb`, at most 25 MB.
- `RemoteImage` uses `next/image` for public Supabase URLs.
- When a column is added to `project_media`, also add it to: both `types.ts` files, `extraColumns` and the pending-row mappings in `ProjectForm.tsx`, and `DuplicateProjectButton.tsx`.

## Campaigns and client review

- Dashboard: `components/campaigns/` and `lib/campaigns.ts`. Site: `app/review/[token]/` with server code in `lib/reviewServer.ts` and `lib/reviewAuth.ts`.
- A locked review page sends only the title and the password form to the browser. Until files are released the client receives the smaller review copy, never a link to the original.
- Review and contract links are built from `NEXT_PUBLIC_SITE_URL`.

## Writing style for text on the site

First person ("I", "Hire Me"). Plain wording. No invented numbers or sample content.
