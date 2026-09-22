export function SetupRequired() {
  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Supabase is not configured</h1>
      <p className="text-sm text-[var(--muted)]">
        This static site talks to Supabase from the browser. Set{" "}
        <code className="font-mono text-xs">VITE_SUPABASE_URL</code> and{" "}
        <code className="font-mono text-xs">VITE_SUPABASE_ANON_KEY</code> before building.
        Locally, copy <code className="font-mono text-xs">.env.example</code> to{" "}
        <code className="font-mono text-xs">.env.local</code>. On GitHub Actions, add the same
        names as repository secrets.
      </p>
    </div>
  );
}
