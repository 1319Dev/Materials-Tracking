import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth, useGuestData } from "@/auth/auth-context";
import { PageShell } from "@/components/page-shell";
import { PrimaryButton, SecondaryButton } from "@/components/ui";
import { loadDashboard, type RecentCheckIn } from "@/lib/app-data";
import { formatWhen } from "@/lib/format";

export function DashboardPage() {
  const { user } = useAuth();
  const local = useGuestData();
  const [materialCount, setMaterialCount] = useState(0);
  const [checkInCount, setCheckInCount] = useState(0);
  const [recent, setRecent] = useState<RecentCheckIn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await loadDashboard(local);
      if (cancelled) return;
      setError(result.error);
      setMaterialCount(result.materialCount);
      setCheckInCount(result.checkInCount);
      setRecent(result.recent);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [local]);

  return (
    <PageShell
      title="Dashboard"
      description="Import your materials catalog, check in receipts with documents, then search inventory by product, heat, or serial."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Catalog items" value={loading ? "…" : materialCount} />
        <Stat label="Check-ins" value={loading ? "…" : checkInCount} />
        <Stat label={local ? "Session" : "Signed in"} value={user?.email?.split("@")[0] ?? (local ? "Guest" : "—")} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <PrimaryButton to="/import" className="w-full">
          Import spreadsheet
        </PrimaryButton>
        <PrimaryButton to="/check-in" className="w-full">
          Check in materials
        </PrimaryButton>
        <SecondaryButton to="/inventory" className="w-full">
          View inventory
        </SecondaryButton>
      </div>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Recent check-ins
          </h2>
          <Link to="/inventory" className="text-sm font-medium text-[var(--accent)]">
            See all
          </Link>
        </div>
        {!recent.length ? (
          <p className="px-4 py-8 text-sm text-[var(--muted)]">
            {loading
              ? "Loading…"
              : "No check-ins yet. Import a catalog, then check in your first receipt."}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {recent.map((row) => (
              <li key={row.id}>
                <Link
                  to={`/inventory/${row.id}`}
                  className="flex flex-col gap-1 px-4 py-3 hover:bg-[var(--surface-2)] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-[var(--ink)]">{row.product_name}</p>
                    <p className="font-mono text-xs text-[var(--muted)]">
                      Heat {row.heat_number || "—"}
                      {row.serial_number ? ` · SN ${row.serial_number}` : ""}
                      {` · qty ${row.quantity}`}
                    </p>
                  </div>
                  <p className="text-xs text-[var(--muted)]">{formatWhen(row.received_at)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-1 truncate text-xl font-semibold text-[var(--ink)]">{value}</p>
    </div>
  );
}
