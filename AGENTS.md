# Materials Tracking

Static Vite + React + TypeScript app deployed to GitHub Pages (`base: /Materials-Tracking/`).

Supabase is used only from the browser (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) with the existing RLS policies. Do not add a Node server, Vercel, or Netlify hosting path.

Auth callbacks belong at `/auth/callback` under the Pages base path. Keep `flowType: 'pkce'` and `detectSessionInUrl: true`.
