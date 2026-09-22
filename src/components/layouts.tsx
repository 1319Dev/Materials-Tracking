import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";
import { AppHeader } from "@/components/app-header";
import { GuestBanner } from "@/components/guest-banner";
import { guestModeEnabled } from "@/lib/guest-store";
import { isSupabaseConfigured } from "@/lib/supabase";

export function AuthLayout() {
  const { user, loading } = useAuth();
  if (isSupabaseConfigured() && loading) return <CenteredNote>Loading…</CenteredNote>;
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <p className="text-2xl font-semibold tracking-tight text-[var(--ink)]">
          Materials Tracking
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Catalog import, material check-in, packing lists &amp; MTRs
        </p>
      </div>
      <div className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <Outlet />
      </div>
    </div>
  );
}

export function RequireAuth() {
  const { user, loading, guest } = useAuth();
  const location = useLocation();
  const guestBrowsing = !user && (guest || guestModeEnabled());

  if (isSupabaseConfigured() && loading) return <CenteredNote>Loading…</CenteredNote>;
  if (!user && !guestBrowsing) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to="/login" replace state={{ next }} />;
  }

  return (
    <div className="flex min-h-full flex-col">
      {guestBrowsing ? <GuestBanner /> : null}
      <AppHeader />
      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}

function CenteredNote({ children }: { children: string }) {
  return (
    <p className="flex min-h-full items-center justify-center px-4 text-sm text-[var(--muted)]">
      {children}
    </p>
  );
}
