import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useGuestData } from "@/auth/auth-context";
import { PageShell } from "@/components/page-shell";
import { Field, SecondaryButton, inputClassName } from "@/components/ui";
import { loadMaterialDetail } from "@/lib/app-data";
import { emptyMtrDraft, mtrRequestText, type MtrRequestDraft } from "@/lib/mtr-request";
import { splitHeatLotSerial } from "@/lib/quantities";

export function MtrRequestPage() {
  const { materialId = "" } = useParams();
  const [params] = useSearchParams();
  const receiptId = params.get("receipt");
  const local = useGuestData();
  const [draft, setDraft] = useState<MtrRequestDraft>(emptyMtrDraft);
  const [ready, setReady] = useState(false);
  const [missing, setMissing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await loadMaterialDetail(local, materialId);
      if (cancelled) return;
      if (result.error) setError(result.error);
      if (!result.row) {
        setMissing(true);
        setReady(true);
        return;
      }
      const row = result.row;
      const material = row.material;
      const checkIn = (receiptId && row.checkIns.find((entry) => entry.id === receiptId)) || row.latestCheckIn;
      const identity = splitHeatLotSerial(material.heat_lot_serial);
      const qty = checkIn?.quantity || (row.onHand > 0 ? row.onHand : row.ordered);
      const base = emptyMtrDraft();
      setDraft({
        ...base,
        manufacturer: material.manufacturer ?? "",
        projectNumber: material.project_number ?? "",
        constructionOrder: material.construction_order ?? "",
        description: material.description || material.product_name,
        sizeInches: material.size_inches || material.size || "",
        wallSdr: material.wall_sdr ?? "",
        steelGrade: material.steel_grade || material.material_grade || "",
        modelNumber: material.model_number ?? "",
        ansiRating: material.ansi_rating ?? "",
        heatNumber: checkIn && checkIn.heat_number !== "N/A" ? checkIn.heat_number : identity.heat,
        lotNumber: checkIn?.lot_number || identity.lot,
        serialNumber: checkIn?.serial_number || identity.serial,
        quantity: qty ? String(qty) : "",
        unit: material.unit ?? "",
      });
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [local, materialId, receiptId]);

  function setField<K extends keyof MtrRequestDraft>(key: K, value: MtrRequestDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setCopied(false);
  }

  async function copyRequest() {
    const text = mtrRequestText(draft);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
      setError("Clipboard is blocked in this browser. Use Download or Print.");
    }
  }

  function downloadRequest() {
    const text = mtrRequestText(draft);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const slug = (draft.projectNumber || draft.description || "mtr-request").replace(/[^\w.-]+/g, "-").slice(0, 40);
    anchor.href = url;
    anchor.download = `mtr-request-${slug}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!ready) {
    return (
      <PageShell title="MTR request">
        <p className="text-sm text-[var(--muted)]">Loading the line…</p>
      </PageShell>
    );
  }

  if (missing) {
    return (
      <PageShell title="MTR request" actions={<SecondaryButton to="/inventory">Back to on hand</SecondaryButton>}>
        <p className="text-sm text-[var(--muted)]">That material is not on this device.</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="MTR request"
      description="Prefilled from the BOM line and the latest check-in. Change anything, then print, copy, or download. This is a request, not the mill certificate."
      headerClassName="no-print"
      actions={
        <div className="no-print flex flex-wrap gap-2">
          <SecondaryButton type="button" onClick={() => window.print()}>
            Print
          </SecondaryButton>
          <SecondaryButton type="button" onClick={copyRequest}>
            {copied ? "Copied" : "Copy"}
          </SecondaryButton>
          <SecondaryButton type="button" onClick={downloadRequest}>
            Download
          </SecondaryButton>
          <SecondaryButton to={`/materials/${materialId}`}>Back to material</SecondaryButton>
        </div>
      }
    >
      {error ? <p className="no-print text-sm text-[var(--danger)]">{error}</p> : null}
      <article className="print-sheet space-y-5 rounded-lg border border-[var(--border)] bg-white p-4 sm:p-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Materials tracking</p>
          <h2 className="text-2xl font-semibold text-[var(--ink)]">Material test report request</h2>
        </header>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="To (manufacturer)" value={draft.manufacturer} onChange={(value) => setField("manufacturer", value)} />
          <TextField label="Request date" value={draft.requestDate} onChange={(value) => setField("requestDate", value)} type="date" />
          <TextField label="Project number" value={draft.projectNumber} onChange={(value) => setField("projectNumber", value)} />
          <TextField label="Construction order" value={draft.constructionOrder} onChange={(value) => setField("constructionOrder", value)} />
        </div>
        <TextField label="Description" value={draft.description} onChange={(value) => setField("description", value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Size (inches)" value={draft.sizeInches} onChange={(value) => setField("sizeInches", value)} />
          <TextField label="Wall / SDR" value={draft.wallSdr} onChange={(value) => setField("wallSdr", value)} />
          <TextField label="Steel grade" value={draft.steelGrade} onChange={(value) => setField("steelGrade", value)} />
          <TextField label="Model number" value={draft.modelNumber} onChange={(value) => setField("modelNumber", value)} />
          <TextField label="ANSI / pressure rating" value={draft.ansiRating} onChange={(value) => setField("ansiRating", value)} />
          <TextField label="Quantity" value={draft.quantity} onChange={(value) => setField("quantity", value)} />
          <TextField label="Heat number" value={draft.heatNumber} onChange={(value) => setField("heatNumber", value)} />
          <TextField label="Lot number" value={draft.lotNumber} onChange={(value) => setField("lotNumber", value)} />
          <TextField label="Serial number" value={draft.serialNumber} onChange={(value) => setField("serialNumber", value)} />
          <TextField label="Unit" value={draft.unit} onChange={(value) => setField("unit", value)} />
          <TextField label="Requested by" value={draft.requestedBy} onChange={(value) => setField("requestedBy", value)} />
        </div>
        <Field label="Notes">
          <textarea
            className={`${inputClassName} min-h-28`}
            value={draft.notes}
            onChange={(event) => setField("notes", event.target.value)}
          />
        </Field>
      </article>
    </PageShell>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <Field label={label}>
      <input className={inputClassName} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}
