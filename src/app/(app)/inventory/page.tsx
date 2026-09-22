import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { inputClassName } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

function formatWhen(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const supabase = await createClient();

  let request = supabase
    .from("check_ins")
    .select(
      "id, product_name, product_code, heat_number, serial_number, quantity, received_at, documents(count)",
    )
    .order("received_at", { ascending: false })
    .limit(100);

  if (query) {
    const pattern = `%${query}%`;
    request = request.or(
      `product_name.ilike.${pattern},product_code.ilike.${pattern},heat_number.ilike.${pattern},serial_number.ilike.${pattern}`,
    );
  }

  const { data: rows, error } = await request;

  return (
    <PageShell
      title="Inventory"
      description="Search received materials by product, heat number, or serial number."
    >
      <form className="flex flex-col gap-2 sm:flex-row" action="/inventory" method="get">
        <input
          className={inputClassName}
          name="q"
          defaultValue={query}
          placeholder="Search product, heat, or serial"
        />
        <button
          type="submit"
          className="min-h-11 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
        >
          Search
        </button>
      </form>

      {error ? (
        <p className="text-sm text-[var(--danger)]">{error.message}</p>
      ) : !rows?.length ? (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-sm text-[var(--muted)]">
          {query
            ? "No check-ins match that search."
            : "No check-ins yet. Use Check in after importing a catalog."}
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          {rows.map((row) => {
            const docCount =
              Array.isArray(row.documents) && row.documents[0]
                ? Number((row.documents[0] as { count: number }).count)
                : 0;
            return (
              <li key={row.id}>
                <Link
                  href={`/inventory/${row.id}`}
                  className="flex flex-col gap-1 px-4 py-3 hover:bg-[var(--surface-2)] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-[var(--ink)]">{row.product_name}</p>
                    <p className="font-mono text-xs text-[var(--muted)]">
                      {[row.product_code, `Heat ${row.heat_number || "—"}`]
                        .filter(Boolean)
                        .join(" · ")}
                      {row.serial_number ? ` · SN ${row.serial_number}` : ""}
                      {` · qty ${row.quantity}`}
                      {docCount ? ` · ${docCount} doc${docCount === 1 ? "" : "s"}` : ""}
                    </p>
                  </div>
                  <p className="text-xs text-[var(--muted)]">{formatWhen(row.received_at)}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
