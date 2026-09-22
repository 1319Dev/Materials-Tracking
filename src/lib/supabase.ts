import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";

export function isSupabaseConfigured() {
  if (!url || !anonKey) return false;
  if (url.includes("your-project")) return false;
  if (anonKey === "your-anon-key" || anonKey.includes("YOUR_ANON")) return false;
  return true;
}

export const supabase: SupabaseClient<Database> = createClient<Database>(
  url || "https://placeholder.supabase.co",
  anonKey || "placeholder-anon-key",
  {
    auth: {
      flowType: "pkce",
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
      storageKey: "materials-tracking-auth",
    },
  },
);
