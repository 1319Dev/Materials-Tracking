import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNextPath } from "@/lib/paths";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { SetupRequired } from "@/components/setup-required";

const OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    let cancelled = false;

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const next = safeNextPath(params.get("next"));
      const description =
        params.get("error_description") || hash.get("error_description");

      if (description) {
        setError(description);
        return;
      }

      const tokenHash = params.get("token_hash");
      const typeParam = params.get("type");
      if (tokenHash && typeParam && OTP_TYPES.has(typeParam as EmailOtpType)) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: typeParam as EmailOtpType,
        });
        if (cancelled) return;
        if (verifyError) {
          setError(verifyError.message);
          return;
        }
        navigate(next, { replace: true });
        return;
      }

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (cancelled) return;
      if (sessionError) {
        setError(sessionError.message);
        return;
      }
      if (data.session) {
        navigate(next, { replace: true });
        return;
      }

      const code = params.get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (exchangeError) {
          setError(exchangeError.message);
          return;
        }
        navigate(next, { replace: true });
        return;
      }

      setError("No auth session found. Request a new magic link and open it in this browser.");
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (!isSupabaseConfigured()) return <SetupRequired />;

  return (
    <div className="flex min-h-full items-center justify-center px-4">
      <div className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 text-sm">
        {error ? (
          <>
            <p className="text-[var(--danger)]">{error}</p>
            <button
              type="button"
              className="mt-4 font-medium text-[var(--accent)]"
              onClick={() => navigate("/login", { replace: true })}
            >
              Back to sign in
            </button>
          </>
        ) : (
          <p className="text-[var(--muted)]">Completing sign-in…</p>
        )}
      </div>
    </div>
  );
}
