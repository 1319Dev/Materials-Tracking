export default function AuthLayout({ children }: { children: React.ReactNode }) {
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
        {children}
      </div>
    </div>
  );
}
