import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";
import { guestModeEnabled } from "@/lib/guest-store";
import { isSupabaseConfigured } from "@/lib/supabase";

export function HomeRedirect() {
  const { user, loading, guest } = useAuth();
  if (isSupabaseConfigured() && loading) {
    return (
      <p className="flex min-h-full items-center justify-center text-sm text-[var(--muted)]">
        Loading…
      </p>
    );
  }
  if (user || guest || guestModeEnabled()) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Navigate to="/login" replace />;
}
