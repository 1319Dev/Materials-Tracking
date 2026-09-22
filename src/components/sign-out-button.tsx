"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-2)]"
    >
      Sign out
    </button>
  );
}
