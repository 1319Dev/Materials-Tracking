import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { AuthContext, type AuthState } from "@/auth/auth-context";
import { disableGuestMode, enableGuestMode, guestModeEnabled } from "@/lib/guest-store";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

function sessionState(user: User | null): AuthState {
  if (user) disableGuestMode();
  return {
    loading: false,
    user,
    guest: user ? false : guestModeEnabled(),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    loading: isSupabaseConfigured(),
    user: null,
    guest: guestModeEnabled(),
  });

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setState({ loading: false, user: null, guest: guestModeEnabled() });
      return;
    }

    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setState(sessionState(data.session?.user ?? null));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(sessionState(session?.user ?? null));
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const enterGuest = useCallback(() => {
    enableGuestMode();
    setState((prev) => ({ ...prev, guest: true }));
  }, []);

  const exitGuest = useCallback(() => {
    disableGuestMode();
    setState((prev) => ({ ...prev, guest: false }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, enterGuest, exitGuest }}>{children}</AuthContext.Provider>
  );
}
