import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";
import { SetupRequired } from "@/components/setup-required";
import { Field, PrimaryButton, SecondaryButton, inputClassName } from "@/components/ui";
import { authCallbackUrl, safeNextPath } from "@/lib/paths";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { enterGuest } = useAuth();
  const configured = isSupabaseConfigured();
  const stateNext = (location.state as { next?: string } | null)?.next;
  const params = new URLSearchParams(location.search);
  const next = safeNextPath(stateNext || params.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    params.get("error_description") ||
      (params.get("error") ? "Sign-in link was rejected. Request a new one." : null),
  );
  const [busy, setBusy] = useState(false);

  async function onPasswordSignIn(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (signInError) {
      setError(signInError.message);
    }
  }

  async function onMagicLink() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: authCallbackUrl(next),
      },
    });
    setBusy(false);
    if (otpError) {
      setError(otpError.message);
      return;
    }
    setMessage("Check your email for the magic link. Open it in this browser.");
  }

  function onContinueWithoutSignIn() {
    enterGuest();
    navigate(next, { replace: true });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Browse the app with sample data, or use email and password.
        </p>
      </div>

      <div className="space-y-2">
        <PrimaryButton type="button" onClick={onContinueWithoutSignIn} className="w-full">
          Continue without signing in
        </PrimaryButton>
        <p className="text-center text-xs text-[var(--muted)]">
          Opens the dashboard, import, check-in, and inventory. Sample rows stay on this device.
        </p>
      </div>

      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        <span className="h-px flex-1 bg-[var(--border)]" />
        or sign in
        <span className="h-px flex-1 bg-[var(--border)]" />
      </div>

      {configured ? (
        <form onSubmit={onPasswordSignIn} className="space-y-4">
        <Field label="Email">
          <input
            className={inputClassName}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password" hint="Leave blank if using magic link only.">
          <input
            className={inputClassName}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        {message ? <p className="text-sm text-[var(--ok)]">{message}</p> : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <PrimaryButton type="submit" disabled={busy || !password} className="flex-1">
            Sign in
          </PrimaryButton>
          <SecondaryButton
            type="button"
            disabled={busy || !email}
            onClick={onMagicLink}
            className="flex-1"
          >
            Send magic link
          </SecondaryButton>
        </div>
        </form>
      ) : (
        <SetupRequired />
      )}

      <p className="text-sm text-[var(--muted)]">
        Need an account?{" "}
        <Link to="/signup" className="font-medium text-[var(--accent)]">
          Sign up
        </Link>
      </p>
    </div>
  );
}
