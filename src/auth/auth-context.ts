import { createContext, useContext } from "react";
import type { User } from "@supabase/supabase-js";

export type AuthState = {
  loading: boolean;
  user: User | null;
};

export const AuthContext = createContext<AuthState>({ loading: true, user: null });

export function useAuth() {
  return useContext(AuthContext);
}
