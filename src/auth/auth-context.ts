import { createContext, useContext } from "react";
import type { User } from "@supabase/supabase-js";
import { guestModeEnabled } from "@/lib/guest-store";

export type AuthState = {
  loading: boolean;
  user: User | null;
  guest: boolean;
};

export type AuthContextValue = AuthState & {
  enterGuest: () => void;
  exitGuest: () => void;
};

export const AuthContext = createContext<AuthContextValue>({
  loading: true,
  user: null,
  guest: false,
  enterGuest: () => {},
  exitGuest: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

/** True when the UI should read and write the on-device sample catalog. */
export function useGuestData() {
  const { user, guest } = useAuth();
  return !user && (guest || guestModeEnabled());
}
