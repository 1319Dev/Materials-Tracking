import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { Field, PrimaryButton, inputClassName } from "@/components/ui";
import { authCallbackUrl } from "@/lib/paths";
import { supabase } from "@/lib/supabase";

export function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: authCallbackUrl("/dashboard"),
      },
    });
    setBusy(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (data.session) return;
    setMessage("Account created. Check your email to confirm, then sign in.");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Create account</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Email and password. Confirmation may be required depending on project settings.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
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
        <Field label="Password" hint="At least 6 characters.">
          <input
            className={inputClassName}
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        {message ? <p className="text-sm text-[var(--ok)]">{message}</p> : null}
        <PrimaryButton type="submit" disabled={busy} className="w-full">
          Sign up
        </PrimaryButton>
      </form>

      <p className="text-sm text-[var(--muted)]">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-[var(--accent)]">
          Sign in
        </Link>
      </p>
    </div>
  );
}
