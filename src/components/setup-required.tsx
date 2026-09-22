export function SetupRequired() {
  return (
    <p className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--muted)]">
      Cloud sign-in is not configured for this build. You can still browse the sample app on this
      device. Set <code className="font-mono text-xs">VITE_SUPABASE_URL</code> and{" "}
      <code className="font-mono text-xs">VITE_SUPABASE_ANON_KEY</code> to enable accounts.
    </p>
  );
}
