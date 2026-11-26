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
- **Gallery images keep their own shape.** `ProjectImage` measures the image and never crops. Images sit in a grid: rows of one height (`--image-row`) that stretch to fill the width, and a click opens the image large. Videos, books and YouTube keep the taller `--media-row`. A single 3D model takes the full width; several sit two to a row.
- **Website / App look** (`projects.display_style = 'web'`): `DeviceScreen.tsx` picks the frame from the file's shape: wide is a browser window on a laptop, tall is a phone, and a full-page screenshot (width ÷ height under 0.42) scrolls inside a browser window. The shape cannot tell a short desktop page from a phone screen, so `project_media.device` (`laptop`, `phone`, or empty for automatic) overrides it, and `cover` marks a designed 3:4 picture that is the project card only and is left out of the page: set at upload for a tall image at least 1400 px wide, and changed with the "Frame" button on the tile. A long page set to `phone` scrolls inside the phone. Videos play muted on a loop in the same frames. Projects also have `live_url`, `app_store_url` and `play_store_url`, shown as buttons on any look, and `tech_stack` is shown as chips under "Tech stack".
- **Project text as cards**: the description is split at its headings (`splitRichText` in `landing-page/src/lib/sanitize.ts`); the text before the first heading sits under the title and each headed part is a card whose list items are numbered tiles. Tech stack and links are cards too. On the Website / App look, wide screens show the text in a left column that stays in view (`StickyColumn.tsx`) while the screens scroll on the right. `project_media.section` (1 for the first heading, 2 for the second, empty for the opening text) puts a file beside one headed part: that part then gets a row of its own below, with its text staying in view beside its screens. Set with the "Text" button on the tile.
- **Uploads**: images are shrunk in the browser to at most 2400 px on the long side (WebP). Wide banners should be exported at about 2400 px wide so they stay sharp. A very tall image (a full-page screenshot) is limited to 1600 px wide instead, so it stays readable. 3D models are `.glb`, at most 25 MB.
- `RemoteImage` uses `next/image` for public Supabase URLs.
- When a column is added to `project_media`, also add it to: both `types.ts` files, `extraColumns` and the pending-row mappings in `ProjectForm.tsx`, and `DuplicateProjectButton.tsx`.

## Campaigns and client review

- Dashboard: `components/campaigns/` and `lib/campaigns.ts`. Site: `app/review/[token]/` with server code in `lib/reviewServer.ts` and `lib/reviewAuth.ts`.
- A locked review page sends only the title and the password form to the browser. Until files are released the client receives the smaller review copy, never a link to the original.
- Review and contract links are built from `NEXT_PUBLIC_SITE_URL`.

## Writing style for text on the site

First person ("I", "Hire Me"). Plain wording. No invented numbers or sample content.
