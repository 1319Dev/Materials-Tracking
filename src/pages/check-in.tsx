import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGuestData } from "@/auth/auth-context";
import { PageShell } from "@/components/page-shell";
import { Field, PrimaryButton, inputClassName } from "@/components/ui";
import { loadMaterials, saveCheckIn } from "@/lib/app-data";
import type { Material } from "@/lib/database.types";

type DocPick = {
  packingList: File | null;
  mtr: File | null;
};

export function CheckInPage() {
  const navigate = useNavigate();
  const local = useGuestData();
  const [query, setQuery] = useState("");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selected, setSelected] = useState<Material | null>(null);
  const [open, setOpen] = useState(false);
  const [heatNumber, setHeatNumber] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [docs, setDocs] = useState<DocPick>({ packingList: null, mtr: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { materials: rows, error: loadError } = await loadMaterials(local);
      if (!cancelled) {
        setError(loadError);
        setMaterials(rows);
        setLoadingCatalog(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [local]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return materials.slice(0, 12);
    return materials
      .filter((m) => {
        const hay = `${m.product_name} ${m.product_code ?? ""} ${m.size ?? ""} ${m.material_grade ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 12);
  }, [materials, query]);

  function pickMaterial(material: Material) {
    setSelected(material);
    setQuery(
      material.product_code
        ? `${material.product_code} — ${material.product_name}`
        : material.product_name,
    );
    setOpen(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selected) {
      setError("Select a product from the catalog.");
      return;
    }
    if (selected.heat_number_required && !heatNumber.trim()) {
      setError("Heat number is required for this product.");
      return;
    }
    if (selected.requires_serial && !serialNumber.trim()) {
      setError("Serial number is required for this product.");
      return;
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Quantity must be a positive number.");
      return;
    }

    setBusy(true);
    const files: Array<{ file: File; docType: "packing_list" | "mtr" }> = [];
    if (docs.packingList) files.push({ file: docs.packingList, docType: "packing_list" });
    if (docs.mtr) files.push({ file: docs.mtr, docType: "mtr" });

    const saved = await saveCheckIn(local, {
      material: selected,
      heatNumber,
      serialNumber,
      quantity: qty,
      notes,
      files,
    });
    setBusy(false);
    if ("error" in saved) {
      setError(saved.error);
      return;
    }
    navigate(`/inventory/${saved.id}`);
  }

  return (
    <PageShell
      title="Check in materials"
      description={
        local
          ? "Search the sample catalog, enter heat/serial, and save on this device. Sign in to save to the cloud."
          : "Search the catalog, enter heat/serial, attach packing list and/or MTR, then save."
      }
    >
      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <Field
          label="Product"
          hint={
            loadingCatalog
              ? "Loading catalog…"
              : materials.length
                ? "Type to search imported materials."
                : "Catalog is empty — import a spreadsheet first."
          }
        >
          <div className="relative">
            <input
              className={inputClassName}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(null);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder="Search product name or code"
              autoComplete="off"
              required
            />
            {open && filtered.length > 0 ? (
              <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-[var(--border)] bg-white shadow-md">
                {filtered.map((material) => (
                  <li key={material.id}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-[var(--surface-2)]"
                      onClick={() => pickMaterial(material)}
                    >
                      <span className="text-sm font-medium">{material.product_name}</span>
                      <span className="font-mono text-xs text-[var(--muted)]">
                        {[material.product_code, material.size, material.material_grade]
                          .filter(Boolean)
                          .join(" · ") || "No code/size"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </Field>

        {selected ? (
          <p className="rounded-md bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--muted)]">
            Selected: <span className="font-medium text-[var(--ink)]">{selected.product_name}</span>
            {selected.requires_serial ? " · serial required" : ""}
            {selected.heat_number_required ? " · heat # required" : ""}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Heat number">
            <input
              className={inputClassName}
              value={heatNumber}
              onChange={(e) => setHeatNumber(e.target.value)}
              required={selected?.heat_number_required ?? true}
              placeholder="e.g. H4521"
            />
          </Field>
          <Field
            label="Serial number"
            hint={selected?.requires_serial ? "Required for this product." : "Optional"}
          >
            <input
              className={inputClassName}
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              required={selected?.requires_serial ?? false}
              placeholder="If applicable"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Quantity">
            <input
              className={inputClassName}
              type="number"
              min="0.001"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </Field>
          <Field label="Notes" hint="Optional">
            <input
              className={inputClassName}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="PO, truck #, location…"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Packing list" hint="PDF or image">
            <input
              className={inputClassName}
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) =>
                setDocs((prev) => ({
                  ...prev,
                  packingList: e.target.files?.[0] ?? null,
                }))
              }
            />
          </Field>
          <Field label="MTR" hint="Material Test Report — PDF or image">
            <input
              className={inputClassName}
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) =>
                setDocs((prev) => ({
                  ...prev,
                  mtr: e.target.files?.[0] ?? null,
                }))
              }
            />
          </Field>
        </div>

        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

        <PrimaryButton type="submit" disabled={busy || !materials.length}>
          {busy ? "Saving…" : "Save check-in"}
        </PrimaryButton>
      </form>
    </PageShell>
  );
}
