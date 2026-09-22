import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DocumentLinks } from "@/components/document-links";
import { PageShell } from "@/components/page-shell";
import { SecondaryButton } from "@/components/ui";
import type { CheckIn, DocumentRow, Material } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";

function formatWhen(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function InventoryDetailPage() {
  const { id = "" } = useParams();
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
      const { data, error: loadError } = await supabase
        .from("check_ins")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (cancelled) return;
      if (loadError) {
        setError(loadError.message);
        setLoading(false);
        return;
      }
      if (!data) {
        setMissing(true);
        setLoading(false);
        return;
      }

      const [{ data: docs, error: docsError }, materialResult] = await Promise.all([
        supabase
          .from("documents")
          .select("*")
          .eq("check_in_id", id)
          .order("created_at", { ascending: true }),
        data.material_id
          ? supabase.from("materials").select("*").eq("id", data.material_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (cancelled) return;
      if (docsError || materialResult.error) {
        setError(docsError?.message || materialResult.error?.message || "Failed to load details");
      }
      setCheckIn(data);
      setDocuments(docs ?? []);
      setMaterial(materialResult.data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

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
