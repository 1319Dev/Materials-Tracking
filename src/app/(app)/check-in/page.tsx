"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { Field, PrimaryButton, inputClassName } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { Material } from "@/lib/database.types";

type DocPick = {
  packingList: File | null;
  mtr: File | null;
};

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

export default function CheckInPage() {
  const router = useRouter();
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
      const supabase = createClient();
      const { data, error: loadError } = await supabase
        .from("materials")
        .select("*")
        .order("product_name")
        .limit(2000);
      if (!cancelled) {
        if (loadError) setError(loadError.message);
        setMaterials(data ?? []);
        setLoadingCatalog(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      setError("You must be signed in.");
      return;
    }

    const { data: checkIn, error: checkInError } = await supabase
      .from("check_ins")
      .insert({
        user_id: user.id,
        material_id: selected.id,
        product_name: selected.product_name,
        product_code: selected.product_code,
        heat_number: heatNumber.trim() || "N/A",
        serial_number: serialNumber.trim() || null,
        quantity: qty,
        notes: notes.trim() || null,
      })
      .select("id")
      .single();

    if (checkInError || !checkIn) {
      setBusy(false);
      setError(checkInError?.message || "Failed to save check-in");
      return;
    }

    const uploads: Array<{ file: File; doc_type: "packing_list" | "mtr" }> = [];
    if (docs.packingList) uploads.push({ file: docs.packingList, doc_type: "packing_list" });
    if (docs.mtr) uploads.push({ file: docs.mtr, doc_type: "mtr" });

    for (const upload of uploads) {
      const path = `${user.id}/${checkIn.id}/${upload.doc_type}-${Date.now()}-${sanitizeFileName(upload.file.name)}`;
      const { error: storageError } = await supabase.storage
        .from("material-documents")
        .upload(path, upload.file, {
          contentType: upload.file.type || undefined,
          upsert: false,
        });
      if (storageError) {
        setBusy(false);
        setError(storageError.message);
        return;
      }
      const { error: docError } = await supabase.from("documents").insert({
        user_id: user.id,
        check_in_id: checkIn.id,
        doc_type: upload.doc_type,
        storage_path: path,
        file_name: upload.file.name,
        mime_type: upload.file.type || null,
      });
      if (docError) {
        setBusy(false);
        setError(docError.message);
        return;
      }
    }

    setBusy(false);
    router.push(`/inventory/${checkIn.id}`);
    router.refresh();
  }

  return (
    <PageShell
      title="Check in materials"
      description="Search the catalog, enter heat/serial, attach packing list and/or MTR, then save."
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
