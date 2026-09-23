import { FormEvent, useMemo, useState } from "react";
import { useGuestData } from "@/auth/auth-context";
import { PageShell } from "@/components/page-shell";
import { Field, PrimaryButton, SecondaryButton, inputClassName } from "@/components/ui";
import { importCatalog } from "@/lib/app-data";
import { publicAsset } from "@/lib/paths";
import { formatQty } from "@/lib/quantities";
import {
  CATALOG_FIELD_LABELS,
  type CatalogField,
  type MappedMaterialRow,
  type SheetJob,
  autoDetectMapping,
  mapRows,
  parseSpreadsheetFile,
} from "@/lib/spreadsheet";

type Step = "upload" | "map" | "preview" | "done";

export function ImportPage() {
  const local = useGuestData();
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [headerRow, setHeaderRow] = useState(1);
  const [job, setJob] = useState<SheetJob>({ project_number: null, construction_order: null });
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, CatalogField>>({});
  const [mapped, setMapped] = useState<MappedMaterialRow[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ inserted: number; updated: number } | null>(null);

  const previewRows = useMemo(() => mapped.slice(0, 8), [mapped]);
  const mappedFields = Object.values(mapping);

  async function loadBundledSample() {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch(publicAsset("samples/pipeline-bom.xlsx"));
      if (!response.ok) throw new Error("Sample BOM could not be loaded.");
      const blob = await response.blob();
      await onFile(new File([blob], "pipeline-bom.xlsx", { type: blob.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sample BOM could not be loaded.");
      setBusy(false);
    }
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const parsed = await parseSpreadsheetFile(file);
      if (!parsed.headers.length) throw new Error("No header row found in spreadsheet.");
      const detected = autoDetectMapping(parsed.headers);
      setFileName(file.name);
      setHeaderRow(parsed.headerRow);
      setJob(parsed.job);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(detected);
      setStep("map");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setBusy(false);
    }
  }

  function onContinueToPreview(event: FormEvent) {
    event.preventDefault();
    if (!mappedFields.includes("product_name") && !mappedFields.includes("description")) {
      setError("Map the description column (or a product name column).");
      return;
    }
    const { materials, skipped: skipCount } = mapRows(rows, mapping, job);
    setMapped(materials);
    setSkipped(skipCount);
    setError(null);
    setStep("preview");
  }

  async function onImport() {
    setBusy(true);
    setError(null);
    const saved = await importCatalog(local, fileName, mapped);
    setBusy(false);
    if ("error" in saved) {
      setError(saved.error);
      return;
    }
    setResult({ inserted: saved.inserted, updated: saved.updated });
    setStep("done");
  }

  const jobBits = [job.project_number ? `Project ${job.project_number}` : "", job.construction_order ? `CO ${job.construction_order}` : ""]
    .filter(Boolean)
    .join(" · ");

  return (
    <PageShell
      title="Import bill of materials"
      description="Upload Garrett's BOM workbook or a CSV. Headers are detected even when the title block and merged cells sit above the Item row. Ordered qty, size, wall, grade, and the job number land on each line."
    >
      {step === "upload" ? (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <Field label="BOM spreadsheet" hint="CSV or Excel. The header row can sit below a title block.">
            <input
              className={inputClassName}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              disabled={busy}
              onChange={(event) => onFile(event.target.files?.[0] ?? null)}
            />
          </Field>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Samples:{" "}
            <a className="text-[var(--accent)] underline" href={publicAsset("samples/pipeline-bom.xlsx")}>
              pipeline-bom.xlsx
            </a>
            {" · "}
            <a className="text-[var(--accent)] underline" href={publicAsset("samples/materials-catalog.csv")}>
              materials-catalog.csv
            </a>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <SecondaryButton type="button" disabled={busy} onClick={() => loadBundledSample()}>
              Load sample pipeline BOM
            </SecondaryButton>
          </div>
          {error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}
          {busy ? <p className="mt-3 text-sm text-[var(--muted)]">Reading the sheet…</p> : null}
        </section>
      ) : null}

      {step === "map" ? (
        <form onSubmit={onContinueToPreview} className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm text-[var(--muted)]">
            File: <span className="font-medium text-[var(--ink)]">{fileName}</span> · headers on row {headerRow} ·{" "}
            {rows.length} data rows
            {jobBits ? ` · ${jobBits}` : ""}
          </p>
          {!rows.length ? (
            <p className="rounded-md bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink)]">
              The BOM columns were recognized, and this sheet has no filled line items yet.
            </p>
          ) : null}
          <div className="space-y-3">
            {headers.map((header) => (
              <div key={header} className="grid gap-2 sm:grid-cols-[1fr_16rem] sm:items-center">
                <div>
                  <p className="text-sm font-medium">{header}</p>
                  <p className="truncate font-mono text-xs text-[var(--muted)]">e.g. {rows[0]?.[header] || "—"}</p>
                </div>
                <select
                  className={inputClassName}
                  value={mapping[header] ?? "skip"}
                  onChange={(event) =>
                    setMapping((prev) => ({
                      ...prev,
                      [header]: event.target.value as CatalogField,
                    }))
                  }
                >
                  {(Object.keys(CATALOG_FIELD_LABELS) as CatalogField[]).map((field) => (
                    <option key={field} value={field}>
                      {CATALOG_FIELD_LABELS[field]}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <SecondaryButton type="button" onClick={() => setStep("upload")}>
              Back
            </SecondaryButton>
            <PrimaryButton type="submit">Preview</PrimaryButton>
          </div>
        </form>
      ) : null}

      {step === "preview" ? (
        <section className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm text-[var(--muted)]">
            Ready to import <strong className="text-[var(--ink)]">{mapped.length}</strong> BOM lines
            {skipped ? ` (${skipped} rows skipped — missing description)` : ""}. A matching item on the same job is
            updated. Issued quantities already on the line stay put.
            {jobBits ? ` Job on the sheet: ${jobBits}.` : ""}
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="px-2 py-2">Item</th>
                  <th className="px-2 py-2">Description</th>
                  <th className="px-2 py-2">Size</th>
                  <th className="px-2 py-2">Wall</th>
                  <th className="px-2 py-2">Grade</th>
                  <th className="px-2 py-2">Qty</th>
                  <th className="px-2 py-2">Job</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, index) => (
                  <tr key={`${row.product_code ?? row.product_name}-${index}`} className="border-b border-[var(--border)]">
                    <td className="px-2 py-2 font-mono text-xs">{row.product_code || "—"}</td>
                    <td className="px-2 py-2">{row.product_name}</td>
                    <td className="px-2 py-2">{row.size_inches || "—"}</td>
                    <td className="px-2 py-2">{row.wall_sdr || "—"}</td>
                    <td className="px-2 py-2">{row.steel_grade || "—"}</td>
                    <td className="px-2 py-2 font-mono">{row.ordered_qty == null ? "—" : formatQty(row.ordered_qty)}</td>
                    <td className="px-2 py-2 text-xs text-[var(--muted)]">
                      {[row.project_number, row.construction_order].filter(Boolean).join(" · ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <SecondaryButton type="button" onClick={() => setStep("map")} disabled={busy}>
              Back
            </SecondaryButton>
            <PrimaryButton type="button" onClick={onImport} disabled={busy || !mapped.length}>
              {busy ? "Importing…" : "Import BOM"}
            </PrimaryButton>
          </div>
        </section>
      ) : null}

      {step === "done" && result ? (
        <section className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm text-[var(--ok)]">
            {local ? "Saved on this device" : "Import complete"}: {result.inserted} added, {result.updated} updated.
          </p>
          <div className="flex flex-wrap gap-2">
            <PrimaryButton to="/packing-list">Confirm packing list</PrimaryButton>
            <SecondaryButton to="/inventory">On-hand sheet</SecondaryButton>
            <SecondaryButton
              type="button"
              onClick={() => {
                setStep("upload");
                setResult(null);
                setMapped([]);
                setRows([]);
                setHeaders([]);
              }}
            >
              Import another
            </SecondaryButton>
          </div>
        </section>
      ) : null}
    </PageShell>
  );
}
