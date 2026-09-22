import { FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useGuestData } from "@/auth/auth-context";
import { PageShell } from "@/components/page-shell";
import { inputClassName } from "@/components/ui";
import { loadInventory, type InventoryListRow } from "@/lib/app-data";
import { formatWhen } from "@/lib/format";

export function InventoryPage() {
  const local = useGuestData();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = (searchParams.get("q") ?? "").trim();
  const [draft, setDraft] = useState(query);
  const [rows, setRows] = useState<InventoryListRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setDraft(query);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { rows: next, error: loadError } = await loadInventory(local, query);
      if (cancelled) return;
      setError(loadError);
      setRows(next);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [local, query]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const next = draft.trim();
    setSearchParams(next ? { q: next } : {});
  }

  return (
    <PageShell
      title="Inventory"
      description="Search received materials by product, heat number, or serial number."
    >
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={onSearch}>
        <input
          className={inputClassName}
          name="q"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
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
        <p className="text-sm text-[var(--danger)]">{error}</p>
      ) : loading ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : !rows.length ? (
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
                ? Number(row.documents[0].count)
                : 0;
            return (
              <li key={row.id}>
                <Link
                  to={`/inventory/${row.id}`}
                  className="flex flex-col gap-1 px-4 py-3 hover:bg-[var(--surface-2)] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-[var(--ink)]">{row.product_name}</p>
                    <p className="font-mono text-xs text-[var(--muted)]">
                      {[row.product_code, `Heat ${row.heat_number || "—"}`].filter(Boolean).join(" · ")}
                      {row.serial_number ? ` · SN ${row.serial_number}` : ""}
                      {` · qty ${row.quantity}`}
                      {docCount ? ` · ${docCount} doc${docCount === 1 ? "" : "s"}` : ""}
                    </p>
                  </div>
                  <p className="text-xs text-[var(--muted)]">
                    {formatWhen(row.received_at, true)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
