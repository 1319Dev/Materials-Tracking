import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useGuestData } from "@/auth/auth-context";
import { PageShell } from "@/components/page-shell";
import { SecondaryButton } from "@/components/ui";
import { loadMaterialDetail } from "@/lib/app-data";
import {
  MTR_FORM_TITLE,
  MTR_HEADER_FIELDS,
  MTR_LINE_COLUMNS,
  MTR_SHEET_LINE_SLOTS,
  combineHeatNumber,
  downloadMtrWorkbook,
  emptyMtrForm,
  emptyMtrLine,
  mtrRequestText,
  withPrefill,
  type MtrHeaderKey,
  type MtrLineKey,
  type MtrRequestForm,
} from "@/lib/mtr-request";
import { splitHeatLotSerial } from "@/lib/quantities";

export function MtrRequestPage() {
  const { materialId = "" } = useParams();
  const [params] = useSearchParams();
  const receiptId = params.get("receipt");
  const local = useGuestData();
  const [form, setForm] = useState<MtrRequestForm>(emptyMtrForm);
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
      const heat = checkIn && checkIn.heat_number !== "N/A" ? checkIn.heat_number : identity.heat;
      const lot = checkIn?.lot_number || identity.lot;
      const serial = checkIn?.serial_number || identity.serial;
      setForm(
        withPrefill(
          {
            inspectorName: "",
            vendor: "",
            atmosProject: material.project_number ?? "",
            salesOrder: material.construction_order ?? "",
            shipmentNumber: checkIn?.shipment_number ?? "",
          },
          {
            materialDescription: material.description || material.product_name,
            diameter: material.size_inches || material.size || "",
            wallThickness: material.wall_sdr ?? "",
            grade: material.steel_grade || material.material_grade || "",
            heatNumber: combineHeatNumber(heat, lot, serial),
            manufacturer: material.manufacturer ?? "",
          },
        ),
      );
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [local, materialId, receiptId]);

  function setHeader(key: MtrHeaderKey, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setCopied(false);
  }

  function setLine(index: number, key: MtrLineKey, value: string) {
    setForm((prev) => {
      const lines = prev.lines.map((line, lineIndex) => (lineIndex === index ? { ...line, [key]: value } : line));
      return { ...prev, lines };
    });
    setCopied(false);
  }

  function addLine() {
    setForm((prev) => {
      if (prev.lines.length >= MTR_SHEET_LINE_SLOTS) return prev;
      return { ...prev, lines: [...prev.lines, emptyMtrLine()] };
    });
  }

  async function copyRequest() {
    try {
      await navigator.clipboard.writeText(mtrRequestText(form));
      setCopied(true);
    } catch {
      setCopied(false);
      setError("Clipboard is blocked in this browser. Use Download or Print.");
    }
  }

  async function downloadRequest() {
    try {
      await downloadMtrWorkbook(form);
    } catch {
      setError("Could not build the workbook. Print the form instead.");
    }
  }

  if (!ready) {
    return (
      <PageShell title={MTR_FORM_TITLE}>
        <p className="text-sm text-[var(--muted)]">Loading the line…</p>
      </PageShell>
    );
  }

  if (missing) {
    return (
      <PageShell title={MTR_FORM_TITLE} actions={<SecondaryButton to="/inventory">Back to on hand</SecondaryButton>}>
        <p className="text-sm text-[var(--muted)]">That material is not on this device.</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={MTR_FORM_TITLE}
      description="Filled from the BOM line and the check-in. Inspector Name and Vendor stay blank until you type them. Edit any cell, then print or download the workbook."
      headerClassName="no-print"
      wide
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
      <style>{`@media print { @page { size: landscape; margin: 0.4in; } }`}</style>
      {error ? <p className="no-print text-sm text-[var(--danger)]">{error}</p> : null}
      <article className="mtr-sheet overflow-x-auto bg-white text-[var(--ink)]">
        <div className="mtr-head">
          <h2 className="mtr-title">{MTR_FORM_TITLE}</h2>
          {MTR_HEADER_FIELDS.map((field) => (
            <span key={field.key} className="mtr-pair">
              <label className="mtr-label" htmlFor={`mtr-${field.key}`}>
                {field.label}
              </label>
              <input
                id={`mtr-${field.key}`}
                className="mtr-value"
                value={form[field.key]}
                onChange={(event) => setHeader(field.key, event.target.value)}
              />
            </span>
          ))}
        </div>
        <table className="mtr-grid">
          <thead>
            <tr>
              {MTR_LINE_COLUMNS.map((column) => (
                <th key={column.key} scope="col">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {form.lines.map((line, index) => (
              <tr key={index}>
                {MTR_LINE_COLUMNS.map((column) => (
                  <td key={column.key}>
                    <input
                      aria-label={`${column.label} ${index + 1}`}
                      value={line[column.key]}
                      onChange={(event) => setLine(index, column.key, event.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </article>
      <div className="no-print">
        <SecondaryButton type="button" onClick={addLine} disabled={form.lines.length >= MTR_SHEET_LINE_SLOTS}>
          Add line
        </SecondaryButton>
      </div>
    </PageShell>
  );
}
