import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth, useGuestData } from "@/auth/auth-context";
import { OnHandSheet } from "@/components/on-hand-sheet";
import { PageShell } from "@/components/page-shell";
import { PrimaryButton, SecondaryButton } from "@/components/ui";
import { loadDashboard, type RecentCheckIn } from "@/lib/app-data";
import { formatWhen } from "@/lib/format";
import { QTY_LEGEND, type OnHandRow } from "@/lib/quantities";

export function DashboardPage() {
  const { user } = useAuth();
  const local = useGuestData();
  const [materialCount, setMaterialCount] = useState(0);
  const [checkInCount, setCheckInCount] = useState(0);
  const [shortageCount, setShortageCount] = useState(0);
  const [missingMtrCount, setMissingMtrCount] = useState(0);
  const [recent, setRecent] = useState<RecentCheckIn[]>([]);
  const [rows, setRows] = useState<OnHandRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await loadDashboard(local);
      if (cancelled) return;
      setError(result.error);
      setMaterialCount(result.materialCount);
      setCheckInCount(result.checkInCount);
      setShortageCount(result.shortageCount);
      setMissingMtrCount(result.missingMtrCount);
      setRecent(result.recent);
      setRows(result.rows);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [local, reloadKey]);

  return (
    <PageShell
      wide
      title="Materials on the job"
      description="Check a delivery in, confirm it against the packing list, then watch on-hand, ordered, issued, and remaining."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="BOM lines" value={loading ? "…" : materialCount} />
        <Stat label="Receipts" value={loading ? "…" : checkInCount} />
        <Stat label="Short lines" value={loading ? "…" : shortageCount} />
        <Stat label="Received, no MTR" value={loading ? "…" : missingMtrCount} />
      </div>
      <p className="text-xs text-[var(--muted)]">
        {local ? "Guest session on this device." : `Signed in as ${user?.email ?? "your account"}.`} {QTY_LEGEND}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PrimaryButton to="/import" className="w-full">
          Import BOM
        </PrimaryButton>
        <PrimaryButton to="/packing-list" className="w-full">
          Confirm packing list
        </PrimaryButton>
        <SecondaryButton to="/check-in" className="w-full">
          Check in one item
        </SecondaryButton>
        <SecondaryButton to="/inventory" className="w-full">
          On-hand sheet
        </SecondaryButton>
      </div>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">On hand by material</h2>
          <Link to="/inventory" className="text-sm font-medium text-[var(--accent)]">
            Open the sheet
          </Link>
        </div>
        {loading ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : !rows.length ? (
          <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-sm text-[var(--muted)]">
            No BOM lines yet. Import Garrett&apos;s bill of materials, or check in the first delivery.
          </p>
        ) : (
          <OnHandSheet rows={rows} onChanged={() => setReloadKey((value) => value + 1)} />
        )}
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Recent receipts</h2>
          <Link to="/inventory" className="text-sm font-medium text-[var(--accent)]">
            On hand
          </Link>
        </div>
        {!recent.length ? (
          <p className="px-4 py-8 text-sm text-[var(--muted)]">
            {loading ? "Loading…" : "No receipts yet. Confirm a packing list or check in what just arrived."}
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
                      {row.lot_number ? ` · Lot ${row.lot_number}` : ""}
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
