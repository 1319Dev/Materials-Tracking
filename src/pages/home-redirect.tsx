import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";
import { SetupRequired } from "@/components/setup-required";
import { isSupabaseConfigured } from "@/lib/supabase";

export function HomeRedirect() {
  const { user, loading } = useAuth();
  if (!isSupabaseConfigured()) return <SetupRequired />;
  if (loading) {
    return (
      <p className="flex min-h-full items-center justify-center text-sm text-[var(--muted)]">
        Loading…
      </p>
    );
  }
  return <Navigate to={user ? "/dashboard" : "/login"} replace />;
}
