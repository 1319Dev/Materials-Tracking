import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export function SignOutButton() {
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
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
