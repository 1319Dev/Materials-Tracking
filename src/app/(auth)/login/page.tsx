"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Field, PrimaryButton, SecondaryButton, inputClassName } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onPasswordSignIn(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function onMagicLink() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setBusy(false);
    if (otpError) {
      setError(otpError.message);
      return;
    }
    setMessage("Check your email for the magic link.");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Use email/password or a magic link.
        </p>
      </div>

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

      <p className="text-sm text-[var(--muted)]">
        Need an account?{" "}
        <Link href="/signup" className="font-medium text-[var(--accent)]">
          Sign up
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
      <LoginForm />
    </Suspense>
  );
}
