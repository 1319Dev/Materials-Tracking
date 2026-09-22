import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { SecondaryButton } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { DocumentLinks } from "@/components/document-links";

function formatWhen(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function InventoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: checkIn } = await supabase
    .from("check_ins")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!checkIn) notFound();

  const [{ data: documents }, { data: material }] = await Promise.all([
    supabase
      .from("documents")
      .select("*")
      .eq("check_in_id", id)
      .order("created_at", { ascending: true }),
    checkIn.material_id
      ? supabase
          .from("materials")
          .select("*")
          .eq("id", checkIn.material_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <PageShell
      title={checkIn.product_name}
      description={`Received ${formatWhen(checkIn.received_at)}`}
      actions={<SecondaryButton href="/inventory">Back to inventory</SecondaryButton>}
    >
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
        {!documents?.length ? (
          <p className="mt-3 text-sm text-[var(--muted)]">No documents attached.</p>
        ) : (
          <div className="mt-3">
            <DocumentLinks documents={documents} />
          </div>
        )}
      </section>

      <p className="text-sm text-[var(--muted)]">
        <Link href="/check-in" className="font-medium text-[var(--accent)]">
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
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      <p className={`mt-1 text-sm text-[var(--ink)] ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
