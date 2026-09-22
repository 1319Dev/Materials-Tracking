# Materials Tracking

Field-friendly web app for pipeline materials: import a catalog spreadsheet, check in received material with heat/serial numbers, and attach packing lists and MTRs.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase (Postgres + Auth + Storage) via `@supabase/ssr`

## Setup

1. **Clone and install**

   ```bash
   npm install
   ```

2. **Environment variables**

   Copy `.env.example` to `.env.local` and fill in values from your Supabase project (**Settings → API**):

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
   ```

   Never commit `.env.local` or real secrets.

3. **Database & storage**

   Apply the SQL migration in `supabase/migrations/` to your Supabase project (SQL Editor, or Supabase CLI `supabase db push` if linked).

   This creates:

   - `import_batches`, `materials`, `check_ins`, `documents` (RLS: users only see their own rows)
   - Storage bucket `material-documents` (private; path prefix = `auth.uid()`)

4. **Auth**

   In Supabase Auth settings, enable **Email** provider (password and/or magic link).

   Add your app URL to **Redirect URLs**, e.g. `http://localhost:3000/auth/callback` and your production callback URL.

5. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000), sign up, then:

   - **Import** a CSV/XLSX (sample: `/samples/materials-catalog.csv`)
   - **Check in** materials with heat/serial + packing list / MTR
   - **Inventory** to search by product, heat, or serial

## Scripts

| Command        | Description              |
| -------------- | ------------------------ |
| `npm run dev`  | Local development server |
| `npm run build`| Production build         |
| `npm run start`| Serve production build   |
| `npm run lint` | ESLint                   |

## Data model (summary)

| Table            | Purpose                                      |
| ---------------- | -------------------------------------------- |
| `materials`      | Catalog from spreadsheet import              |
| `import_batches` | Import run metadata                          |
| `check_ins`      | Received material (heat, serial, qty, notes) |
| `documents`      | Packing list / MTR / other file metadata     |

Out of scope for v1: multi-tenant orgs, barcodes, offline, native apps.
