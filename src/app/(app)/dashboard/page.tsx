import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { PrimaryButton, SecondaryButton } from "@/components/ui";

function formatWhen(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ count: materialCount }, { count: checkInCount }, { data: recent }] =
    await Promise.all([
      supabase.from("materials").select("*", { count: "exact", head: true }),
      supabase.from("check_ins").select("*", { count: "exact", head: true }),
      supabase
        .from("check_ins")
        .select("id, product_name, heat_number, serial_number, quantity, received_at")
        .order("received_at", { ascending: false })
        .limit(8),
    ]);

  return (
    <PageShell
      title="Dashboard"
      description="Import your materials catalog, check in receipts with documents, then search inventory by product, heat, or serial."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Catalog items" value={materialCount ?? 0} />
        <Stat label="Check-ins" value={checkInCount ?? 0} />
        <Stat label="Signed in" value={user?.email?.split("@")[0] ?? "—"} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <PrimaryButton href="/import" className="w-full">
          Import spreadsheet
        </PrimaryButton>
        <PrimaryButton href="/check-in" className="w-full">
          Check in materials
        </PrimaryButton>
        <SecondaryButton href="/inventory" className="w-full">
          View inventory
        </SecondaryButton>
      </div>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Recent check-ins
          </h2>
          <Link href="/inventory" className="text-sm font-medium text-[var(--accent)]">
            See all
          </Link>
        </div>
        {!recent?.length ? (
          <p className="px-4 py-8 text-sm text-[var(--muted)]">
            No check-ins yet. Import a catalog, then check in your first receipt.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {recent.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/inventory/${row.id}`}
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
