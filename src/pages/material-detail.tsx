import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useGuestData } from "@/auth/auth-context";
import { DocumentLinks } from "@/components/document-links";
import { OnHandSheet } from "@/components/on-hand-sheet";
import { PageShell } from "@/components/page-shell";
import { SecondaryButton } from "@/components/ui";
import { loadMaterialDetail } from "@/lib/app-data";
import { formatWhen } from "@/lib/format";
import { QTY_LEGEND, jobLabel, type OnHandRow } from "@/lib/quantities";

export function MaterialDetailPage() {
  const { id = "" } = useParams();
  const local = useGuestData();
  const [row, setRow] = useState<OnHandRow | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const result = await loadMaterialDetail(local, id);
      if (cancelled) return;
      setError(result.error);
      setRow(result.row);
      setMissing(!result.row);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, local, reloadKey]);

  if (loading) {
    return (
      <PageShell title="Material">
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      </PageShell>
    );
  }

  if (missing || !row) {
    return (
      <PageShell title="Material not found" actions={<SecondaryButton to="/inventory">Back to on hand</SecondaryButton>}>
        <p className="text-sm text-[var(--muted)]">That line is not on this BOM.</p>
      </PageShell>
    );
  }

  const material = row.material;
  const receipt = row.latestCheckIn?.id;
  const mtrTo = receipt ? `/mtr-request/${material.id}?receipt=${receipt}` : `/mtr-request/${material.id}`;

  return (
    <PageShell
      wide
      title={material.product_name}
      description={jobLabel(material)}
      actions={<SecondaryButton to="/inventory">Back to on hand</SecondaryButton>}
    >
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <p className="text-sm text-[var(--muted)]">{QTY_LEGEND}</p>
      <OnHandSheet rows={[row]} onChanged={() => setReloadKey((value) => value + 1)} />

      {!row.hasMtr ? (
        <section className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-[var(--ink)]">No MTR on file</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Open a request prefilled from this line, the latest check-in, and the project / construction order. Edit it before you print or copy it.
            </p>
          </div>
          <SecondaryButton to={mtrTo}>Request MTR</SecondaryButton>
        </section>
      ) : (
        <p className="text-sm font-medium text-[var(--ok)]">An MTR is already attached to a receipt for this line.</p>
      )}

      <section className="grid gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2">
        <Detail label="Item" value={material.product_code || "—"} mono />
        <Detail label="Size (inches)" value={material.size_inches || material.size || "—"} />
        <Detail label="Wall / SDR" value={material.wall_sdr || "—"} />
        <Detail label="Steel grade" value={material.steel_grade || material.material_grade || "—"} />
        <Detail label="Manufacturer" value={material.manufacturer || "—"} />
        <Detail label="Model number" value={material.model_number || "—"} />
        <Detail label="ANSI / pressure" value={material.ansi_rating || "—"} />
        <Detail label="BOM heat / lot / serial" value={material.heat_lot_serial || "—"} mono />
        <Detail label="Project" value={material.project_number || "—"} />
        <Detail label="Construction order" value={material.construction_order || "—"} />
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Receipts</h2>
        {!row.checkIns.length ? (
          <p className="mt-3 text-sm text-[var(--muted)]">Nothing received against this line yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {row.checkIns.map((checkIn) => (
              <li key={checkIn.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link to={`/inventory/${checkIn.id}`} className="font-medium text-[var(--accent)]">
                    Qty {checkIn.quantity}
                  </Link>
                  <p className="font-mono text-xs text-[var(--muted)]">
                    Heat {checkIn.heat_number || "—"}
                    {checkIn.lot_number ? ` · Lot ${checkIn.lot_number}` : ""}
                    {checkIn.serial_number ? ` · SN ${checkIn.serial_number}` : ""}
                  </p>
                </div>
                <p className="text-xs text-[var(--muted)]">{formatWhen(checkIn.received_at, true)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Issues to the job</h2>
        {!row.issues.length ? (
          <p className="mt-3 text-sm text-[var(--muted)]">Nothing issued yet. Issued quantity lowers on hand and remaining.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {row.issues.map((issue) => (
              <li key={issue.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">Qty {issue.quantity}</p>
                  <p className="text-xs text-[var(--muted)]">{issue.notes || "Issued to the job"}</p>
                </div>
                <p className="text-xs text-[var(--muted)]">{formatWhen(issue.issued_at, true)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Documents</h2>
        {!row.documents.length ? (
          <p className="mt-3 text-sm text-[var(--muted)]">No packing list or MTR attached.</p>
        ) : (
          <div className="mt-3">
            <DocumentLinks documents={row.documents} />
          </div>
        )}
      </section>
    </PageShell>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className={`mt-1 text-sm text-[var(--ink)] ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
