import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useGuestData } from "@/auth/auth-context";
import { inputClassName } from "@/components/ui";
import { issueMaterial } from "@/lib/app-data";
import { formatQty, jobLabel, type OnHandRow } from "@/lib/quantities";

const QTYS = [
  { key: "onHand", label: "On hand" },
  { key: "ordered", label: "Ordered" },
  { key: "issued", label: "Issued" },
  { key: "remaining", label: "Remaining" },
] as const;

export function OnHandSheet({
  rows,
  showIssue = true,
  onChanged,
}: {
  rows: OnHandRow[];
  showIssue?: boolean;
  onChanged?: () => void;
}) {
  const groups = new Map<string, OnHandRow[]>();
  for (const row of rows) {
    const key = jobLabel(row.material);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([label, group]) => (
        <section key={label} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</h2>
          <div className="space-y-3 md:hidden">
            {group.map((row) => (
              <LineCard key={row.material.id} row={row} showIssue={showIssue} onChanged={onChanged} />
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2">Material</th>
                  <th className="px-3 py-2">On hand</th>
                  <th className="px-3 py-2">Ordered</th>
                  <th className="px-3 py-2">Issued</th>
                  <th className="px-3 py-2">Remaining</th>
                  <th className="px-3 py-2">MTR</th>
                  {showIssue ? <th className="px-3 py-2">Issue</th> : null}
                </tr>
              </thead>
              <tbody>
                {group.map((row) => (
                  <tr key={row.material.id} className="border-b border-[var(--border)] align-top last:border-b-0">
                    <td className="px-3 py-3">
                      <MaterialSummary row={row} />
                    </td>
                    {QTYS.map((qty) => (
                      <td key={qty.key} className="px-3 py-3 font-mono text-sm">
                        <QtyValue row={row} field={qty.key} />
                      </td>
                    ))}
                    <td className="px-3 py-3">
                      <MtrStatus row={row} />
                    </td>
                    {showIssue ? (
                      <td className="px-3 py-3">
                        <IssueForm row={row} onChanged={onChanged} compact />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function LineCard({
  row,
  showIssue,
  onChanged,
}: {
  row: OnHandRow;
  showIssue: boolean;
  onChanged?: () => void;
}) {
  return (
    <article className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <MaterialSummary row={row} />
      <dl className="grid grid-cols-2 gap-2">
        {QTYS.map((qty) => (
          <div key={qty.key} className="rounded-md bg-[var(--surface-2)] px-3 py-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{qty.label}</dt>
            <dd className="mt-1 font-mono text-lg text-[var(--ink)]">
              <QtyValue row={row} field={qty.key} />
            </dd>
          </div>
        ))}
      </dl>
      <MtrStatus row={row} />
      {showIssue ? <IssueForm row={row} onChanged={onChanged} /> : null}
    </article>
  );
}

function MaterialSummary({ row }: { row: OnHandRow }) {
  const material = row.material;
  const meta = [
    material.product_code,
    material.size_inches || material.size ? `${material.size_inches || material.size} in` : "",
    material.wall_sdr ? `wall ${material.wall_sdr}` : "",
    material.steel_grade || material.material_grade,
    material.manufacturer,
    material.model_number,
  ].filter(Boolean);
  return (
    <div>
      <Link to={`/materials/${material.id}`} className="font-medium text-[var(--ink)] hover:text-[var(--accent)]">
        {material.product_name}
      </Link>
      <p className="mt-1 text-xs text-[var(--muted)]">{meta.join(" · ") || "BOM line"}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {row.shortage > 0 ? (
          <span className="rounded-full bg-[var(--danger)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--danger)]">
            Short {formatQty(row.shortage)}
          </span>
        ) : null}
        <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs font-medium text-[var(--muted)]">
          {statusLabel(row)}
        </span>
      </div>
    </div>
  );
}

function QtyValue({ row, field }: { row: OnHandRow; field: (typeof QTYS)[number]["key"] }) {
  const value = row[field];
  const warn = field === "remaining" && value < 0;
  const quiet = field === "onHand" && value <= 0;
  return <span className={warn ? "text-[var(--danger)]" : quiet ? "text-[var(--muted)]" : ""}>{formatQty(value)}</span>;
}

function MtrStatus({ row }: { row: OnHandRow }) {
  if (row.hasMtr) return <span className="text-xs font-semibold text-[var(--ok)]">MTR on file</span>;
  const receipt = row.latestCheckIn?.id;
  const to = receipt ? `/mtr-request/${row.material.id}?receipt=${receipt}` : `/mtr-request/${row.material.id}`;
  return (
    <Link to={to} className="text-sm font-semibold text-[var(--accent)] underline">
      Request MTR
    </Link>
  );
}

function statusLabel(row: OnHandRow) {
  if (row.status === "missing") return "Missing";
  if (row.status === "partial") return "Partial receipt";
  if (row.status === "full") return "Received in full";
  return "Not received";
}

function IssueForm({
  row,
  onChanged,
  compact = false,
}: {
  row: OnHandRow;
  onChanged?: () => void;
  compact?: boolean;
}) {
  const local = useGuestData();
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (row.onHand <= 0) {
    return <p className="text-xs text-[var(--muted)]">Nothing on hand to issue.</p>;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Enter a quantity.");
      return;
    }
    setBusy(true);
    const saved = await issueMaterial(local, { materialId: row.material.id, quantity: qty, notes });
    setBusy(false);
    if ("error" in saved) {
      setError(saved.error);
      return;
    }
    setQuantity("");
    setNotes("");
    onChanged?.();
  }

  return (
    <form onSubmit={onSubmit} className={compact ? "space-y-2" : "space-y-2"}>
      <div className={compact ? "flex flex-col gap-2" : "flex flex-col gap-2 sm:flex-row"}>
        <input
          className={inputClassName}
          inputMode="decimal"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          placeholder={`Qty out (max ${formatQty(row.onHand)})`}
          aria-label={`Issue quantity for ${row.material.product_name}`}
        />
        {compact ? null : (
          <input
            className={inputClassName}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Where it went"
            aria-label="Issue notes"
          />
        )}
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 rounded-md border border-[var(--border)] bg-white px-3 text-sm font-semibold hover:bg-[var(--surface-2)] disabled:opacity-50"
        >
          {busy ? "Issuing…" : "Issue"}
        </button>
      </div>
      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
    </form>
  );
}
