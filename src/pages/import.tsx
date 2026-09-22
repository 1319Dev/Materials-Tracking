import { FormEvent, useMemo, useState } from "react";
import { useGuestData } from "@/auth/auth-context";
import { PageShell } from "@/components/page-shell";
import { Field, PrimaryButton, SecondaryButton, inputClassName } from "@/components/ui";
import { importCatalog } from "@/lib/app-data";
import { publicAsset } from "@/lib/paths";
import {
  CATALOG_FIELD_LABELS,
  type CatalogField,
  type MappedMaterialRow,
  autoDetectMapping,
  mapRows,
  parseSpreadsheetFile,
} from "@/lib/spreadsheet";

type Step = "upload" | "map" | "preview" | "done";

export function ImportPage() {
  const local = useGuestData();
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, CatalogField>>({});
  const [mapped, setMapped] = useState<MappedMaterialRow[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ inserted: number; updated: number } | null>(null);

  const previewRows = useMemo(() => mapped.slice(0, 8), [mapped]);

  async function onFile(file: File | null) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const parsed = await parseSpreadsheetFile(file);
      if (!parsed.headers.length) {
        throw new Error("No header row found in spreadsheet.");
      }
      const detected = autoDetectMapping(parsed.headers);
      setFileName(file.name);
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

  function onContinueToPreview(e: FormEvent) {
    e.preventDefault();
    if (!Object.values(mapping).includes("product_name")) {
      setError("Map at least one column to Product name.");
      return;
    }
    const { materials, skipped: skipCount } = mapRows(rows, mapping);
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

  return (
    <PageShell
      title="Import spreadsheet"
      description={
        local
          ? "Upload CSV or XLSX. In guest mode the catalog is saved on this device. Sign in to save to the cloud."
          : "Upload CSV or XLSX. Map columns, preview, then upsert into your materials catalog used by check-in."
      }
    >
      {step === "upload" ? (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <Field
            label="Spreadsheet file"
            hint="CSV or Excel (.xlsx). First sheet / header row is used."
          >
            <input
              className={inputClassName}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              disabled={busy}
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </Field>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Sample template:{" "}
            <a
              className="text-[var(--accent)] underline"
              href={publicAsset("samples/materials-catalog.csv")}
            >
              materials-catalog.csv
            </a>
          </p>
          {error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}
        </section>
      ) : null}

      {step === "map" ? (
        <form
          onSubmit={onContinueToPreview}
          className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
        >
          <p className="text-sm text-[var(--muted)]">
            File: <span className="font-medium text-[var(--ink)]">{fileName}</span> · {rows.length}{" "}
            rows
          </p>
          <div className="space-y-3">
            {headers.map((header) => (
              <div key={header} className="grid gap-2 sm:grid-cols-[1fr_14rem] sm:items-center">
                <div>
                  <p className="text-sm font-medium">{header}</p>
                  <p className="truncate font-mono text-xs text-[var(--muted)]">
                    e.g. {rows[0]?.[header] || "—"}
                  </p>
                </div>
                <select
                  className={inputClassName}
                  value={mapping[header] ?? "skip"}
                  onChange={(e) =>
                    setMapping((prev) => ({
                      ...prev,
                      [header]: e.target.value as CatalogField,
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
            Ready to import <strong className="text-[var(--ink)]">{mapped.length}</strong> materials
            {skipped ? ` (${skipped} rows skipped — missing product name)` : ""}. Existing matches
            by product code (or name) will be updated.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="px-2 py-2">Code</th>
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Size</th>
                  <th className="px-2 py-2">Grade</th>
                  <th className="px-2 py-2">Serial?</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, idx) => (
                  <tr key={`${row.product_name}-${idx}`} className="border-b border-[var(--border)]">
                    <td className="px-2 py-2 font-mono text-xs">{row.product_code || "—"}</td>
                    <td className="px-2 py-2">{row.product_name}</td>
                    <td className="px-2 py-2">{row.size || "—"}</td>
                    <td className="px-2 py-2">{row.material_grade || "—"}</td>
                    <td className="px-2 py-2">{row.requires_serial ? "Yes" : "No"}</td>
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
              {busy ? "Importing…" : "Import catalog"}
            </PrimaryButton>
          </div>
        </section>
      ) : null}

      {step === "done" && result ? (
        <section className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm text-[var(--ok)]">
            {local ? "Saved on this device" : "Import complete"}: {result.inserted} added,{" "}
            {result.updated} updated.
          </p>
          <div className="flex flex-wrap gap-2">
            <PrimaryButton to="/check-in">Go to check-in</PrimaryButton>
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
