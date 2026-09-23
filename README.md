# Materials Tracking

Field-friendly web app for a pipeline materials coordinator: import a bill of materials, check deliveries in, confirm the packing list line by line, and track on hand, ordered, issued, and remaining. Missing MTRs open a prefilled request you can edit, print, or copy.

Hosted as a **static site on GitHub Pages** (same pattern as Utility Inspector): Vite build → `dist/` → `gh-pages` branch.

Live site: [https://1319dev.github.io/Materials-Tracking/](https://1319dev.github.io/Materials-Tracking/)

## Stack

- Vite + React + TypeScript + Tailwind CSS
- Supabase (Postgres + Auth + Storage) via `@supabase/supabase-js` in the browser
- Row Level Security: each signed-in user only sees their own catalog, check-ins, and files
- Anon key only. No server, no Vercel, no Netlify

## Quick start

```bash
npm install
cp .env.example .env.local
# fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

Open [http://localhost:5173/Materials-Tracking/](http://localhost:5173/Materials-Tracking/).

```bash
npm run build     # static files in dist/ (includes 404.html for Pages)
npm run preview   # serve the production build
npm run lint
```

## Database and storage

Apply `supabase/migrations/` to the Supabase project (SQL Editor, or `supabase db push` if the CLI is linked).

This creates:

- `import_batches`, `materials`, `check_ins`, `documents`, `material_issues` (RLS: users only see their own rows)
- BOM fields on `materials`: ordered qty, issued qty, project, construction order, size, wall/SDR, steel grade, model, ANSI rating, heat/lot/serial, packing-list status
- On hand is received (sum of check-ins) minus issued. Remaining is ordered minus issued when the line has an order qty.
- Storage bucket `material-documents` (private; first path folder must be `auth.uid()`)

## Deploy → GitHub Pages

The site is a project page, so every asset and route lives under `/Materials-Tracking/`. `vite.config.ts` sets `base` to that path. `npm run build` writes `dist/index.html`, copies it to `dist/404.html` (so deep links such as `/auth/callback` load the app), and adds `dist/.nojekyll`.

### 1. Repository secrets

In the GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://YOUR_PROJECT.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Project **anon** / publishable key (Settings → API) |

These are baked into the static bundle at build time. They are public in the browser by design. Do not put the `service_role` key in either secret.

### 2. Let Actions publish `gh-pages`

Workflow: `.github/workflows/deploy-github-pages.yml`

- Pull requests run `npm run build` only.
- A push to `main` (and **Actions → Deploy GitHub Pages → Run workflow**) builds and pushes `dist/` to the `gh-pages` branch with `peaceiris/actions-gh-pages`.

### 3. Turn on Pages

**Settings → Pages → Build and deployment**

- Source: **Deploy from a branch**
- Branch: **`gh-pages`** / **`/ (root)`**

Save. The site is [https://1319dev.github.io/Materials-Tracking/](https://1319dev.github.io/Materials-Tracking/). The first publish creates `gh-pages`; if Pages was already pointed at another branch, switch it to `gh-pages`.

### 4. Supabase Auth URLs

**Authentication → URL configuration**

- **Site URL:** `https://1319dev.github.io/Materials-Tracking/`
- **Redirect URLs** (add each):
  - `https://1319dev.github.io/Materials-Tracking/auth/callback`
  - `http://localhost:5173/Materials-Tracking/auth/callback`

Enable the **Email** provider (password and/or magic link).

Magic links use the PKCE flow (`flowType: 'pkce'`, `detectSessionInUrl: true`). The email must be opened in the **same browser** that requested it, because the code verifier stays in that browser’s local storage. The callback route also accepts `token_hash` + `type` (the documented PKCE email-template form) and hash tokens.

## Using the app

Open the site and choose **Continue without signing in** to walk a sample pipeline job stored in this browser. Email sign-in and magic links stay available when you want to save to Supabase.

With an account, or as a guest:

- **BOM** — import Garrett's bill of materials (sample: `/Materials-Tracking/samples/pipeline-bom.xlsx`). Headers are detected below the title block, including merged cells.
- **Confirm** — mark each packing-list line full, partial, or missing. Received quantities become check-ins and update on hand.
- **Check in** — one delivery: description, heat / lot / serial, qty received, packing list and MTR uploads.
- **On hand** — per material and job: on hand, ordered, issued, and remaining. Issue qty out to the job from the sheet.
- **Request MTR** — when a line has no mill cert, open a prefilled request, edit it, then print, copy, or download.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server at `/Materials-Tracking/` |
| `npm run build` | Typecheck and static production build in `dist/` |
| `npm run preview` | Serve `dist/` |
| `npm run lint` | ESLint |

## Data model

| Table | Purpose |
| --- | --- |
| `materials` | BOM lines: identity, job, ordered qty, issued qty, packing-list status |
| `import_batches` | Import run metadata |
| `check_ins` | Received material (heat, lot, serial, qty, notes) |
| `material_issues` | Quantity issued out to the job |
| `documents` | Packing list / MTR / other file metadata |

Out of scope for v1: multi-tenant orgs, barcodes, offline, native apps.
