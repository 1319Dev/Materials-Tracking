import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useGuestData } from "@/auth/auth-context";
import { DocumentLinks } from "@/components/document-links";
import { PageShell } from "@/components/page-shell";
import { SecondaryButton } from "@/components/ui";
import { loadCheckInDetail } from "@/lib/app-data";
import type { CheckIn, DocumentRow, Material } from "@/lib/database.types";
import { formatQty, type OnHandRow } from "@/lib/quantities";

function formatWhen(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function InventoryDetailPage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const local = useGuestData();
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);
  const [material, setMaterial] = useState<Material | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [row, setRow] = useState<OnHandRow | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setMissing(false);
      const result = await loadCheckInDetail(local, id);
      if (cancelled) return;
      if (result.error) setError(result.error);
      if (!result.checkIn) {
        setMissing(true);
        setLoading(false);
        return;
      }
      setCheckIn(result.checkIn);
      setDocuments(result.documents);
      setMaterial(result.material);
      setRow(result.row);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, local]);

  if (loading) {
    return (
      <PageShell title="Check-in">
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      </PageShell>
    );
  }

  if (missing || !checkIn) {
    return (
      <PageShell title="Check-in not found" actions={<SecondaryButton to="/inventory">Back to on hand</SecondaryButton>}>
        <p className="text-sm text-[var(--muted)]">That receipt is not in your inventory.</p>
      </PageShell>
    );
  }

  const hasMtr = documents.some((doc) => doc.doc_type === "mtr") || Boolean(row?.hasMtr);
  const askForMtr = params.get("needMtr") === "1" || !hasMtr;

  return (
    <PageShell
      title={checkIn.product_name}
      description={`Received ${formatWhen(checkIn.received_at)}`}
      actions={<SecondaryButton to="/inventory">Back to on hand</SecondaryButton>}
    >
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      {askForMtr && !hasMtr && checkIn.material_id ? (
        <section className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--ink)]">This receipt has no MTR. The request form is already filled from the check-in.</p>
          <SecondaryButton to={`/mtr-request/${checkIn.material_id ?? ""}?receipt=${checkIn.id}`}>Request MTR</SecondaryButton>
        </section>
      ) : null}
      <section className="grid gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2">
        <Detail label="Item" value={checkIn.product_code || "—"} mono />
        <Detail label="Qty received" value={String(checkIn.quantity)} />
        <Detail label="Heat number" value={checkIn.heat_number || "—"} mono />
        <Detail label="Lot number" value={checkIn.lot_number || "—"} mono />
        <Detail label="Serial number" value={checkIn.serial_number || "—"} mono />
        {row ? (
          <>
            <Detail label="On hand" value={formatQty(row.onHand)} />
            <Detail label="Ordered" value={formatQty(row.ordered)} />
            <Detail label="Issued" value={formatQty(row.issued)} />
            <Detail label="Remaining" value={formatQty(row.remaining)} />
          </>
        ) : null}
        {material ? (
          <>
            <Detail label="Size (inches)" value={material.size_inches || material.size || "—"} />
            <Detail label="Wall / SDR" value={material.wall_sdr || "—"} />
            <Detail label="Steel grade" value={material.steel_grade || material.material_grade || "—"} />
            <Detail label="Manufacturer" value={material.manufacturer || "—"} />
            <Detail label="Model" value={material.model_number || "—"} />
            <Detail label="Project" value={material.project_number || "—"} />
            <Detail label="Construction order" value={material.construction_order || "—"} />
          </>
        ) : null}
        {checkIn.notes ? (
          <div className="sm:col-span-2">
            <Detail label="Notes" value={checkIn.notes} />
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Documents</h2>
        {!documents.length ? (
          <p className="mt-3 text-sm text-[var(--muted)]">No documents attached.</p>
        ) : (
          <div className="mt-3">
            <DocumentLinks documents={documents} />
          </div>
        )}
      </section>

      <p className="text-sm text-[var(--muted)]">
        {checkIn.material_id ? (
          <Link to={`/materials/${checkIn.material_id}`} className="font-medium text-[var(--accent)]">
            Open the on-hand line
          </Link>
        ) : null}
      </p>
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
