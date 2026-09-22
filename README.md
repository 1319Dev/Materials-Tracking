# Materials Tracking

Field-friendly web app for pipeline materials: import a catalog spreadsheet, check in received material with heat and serial numbers, and attach packing lists and MTRs.

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

- `import_batches`, `materials`, `check_ins`, `documents` (RLS: users only see their own rows)
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

Sign up, then:

- **Import** a CSV or XLSX (sample: `/Materials-Tracking/samples/materials-catalog.csv`)
- **Check in** a product with heat number, serial when the catalog says it is required, quantity, notes, and optional packing list / MTR uploads
- **Inventory** to search by product, heat, or serial and open attached documents

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
| `materials` | Catalog from spreadsheet import |
| `import_batches` | Import run metadata |
| `check_ins` | Received material (heat, serial, qty, notes) |
| `documents` | Packing list / MTR / other file metadata |

Out of scope for v1: multi-tenant orgs, barcodes, offline, native apps.
