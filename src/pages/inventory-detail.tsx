import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useGuestData } from "@/auth/auth-context";
import { DocumentLinks } from "@/components/document-links";
import { PageShell } from "@/components/page-shell";
import { SecondaryButton } from "@/components/ui";
import { loadCheckInDetail } from "@/lib/app-data";
import type { CheckIn, DocumentRow, Material } from "@/lib/database.types";

function formatWhen(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function InventoryDetailPage() {
  const { id = "" } = useParams();
  const local = useGuestData();
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);
  const [material, setMaterial] = useState<Material | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
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
      <PageShell title="Check-in not found" actions={<SecondaryButton to="/inventory">Back to inventory</SecondaryButton>}>
        <p className="text-sm text-[var(--muted)]">That receipt is not in your inventory.</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={checkIn.product_name}
      description={`Received ${formatWhen(checkIn.received_at)}`}
      actions={<SecondaryButton to="/inventory">Back to inventory</SecondaryButton>}
    >
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <section className="grid gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2">
        <Detail label="Product code" value={checkIn.product_code || "—"} mono />
        <Detail label="Quantity" value={String(checkIn.quantity)} />
        <Detail label="Heat number" value={checkIn.heat_number || "—"} mono />
        <Detail label="Serial number" value={checkIn.serial_number || "—"} mono />
        {material ? (
          <>
            <Detail label="Size" value={material.size || "—"} />
            <Detail label="Grade" value={material.material_grade || "—"} />
            <Detail label="Manufacturer" value={material.manufacturer || "—"} />
            <Detail label="Unit" value={material.unit || "ea"} />
          </>
        ) : null}
        {checkIn.notes ? (
          <div className="sm:col-span-2">
            <Detail label="Notes" value={checkIn.notes} />
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Documents
        </h2>
        {!documents.length ? (
          <p className="mt-3 text-sm text-[var(--muted)]">No documents attached.</p>
        ) : (
          <div className="mt-3">
            <DocumentLinks documents={documents} />
          </div>
        )}
      </section>

      <p className="text-sm text-[var(--muted)]">
        <Link to="/check-in" className="font-medium text-[var(--accent)]">
          Check in another receipt
        </Link>
      </p>
    </PageShell>
  );
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className={`mt-1 text-sm text-[var(--ink)] ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
