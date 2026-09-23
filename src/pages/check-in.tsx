import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useGuestData } from "@/auth/auth-context";
import { PageShell } from "@/components/page-shell";
import { Field, PrimaryButton, inputClassName } from "@/components/ui";
import { createMaterial, loadOnHand, saveCheckIn } from "@/lib/app-data";
import type { Material } from "@/lib/database.types";
import { formatQty, jobLabel, splitHeatLotSerial, type OnHandRow } from "@/lib/quantities";

type DocPick = {
  packingList: File | null;
  mtr: File | null;
};

export function CheckInPage() {
  const navigate = useNavigate();
  const local = useGuestData();
  const [rows, setRows] = useState<OnHandRow[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<OnHandRow | null>(null);
  const [custom, setCustom] = useState(false);
  const [open, setOpen] = useState(false);
  const [heatNumber, setHeatNumber] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [shipmentNumber, setShipmentNumber] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [projectNumber, setProjectNumber] = useState("");
  const [constructionOrder, setConstructionOrder] = useState("");
  const [docs, setDocs] = useState<DocPick>({ packingList: null, mtr: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await loadOnHand(local);
      if (!cancelled) {
        setError(result.error);
        setRows(result.rows);
        setLoadingCatalog(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [local]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const source = needle
      ? rows.filter((row) => {
          const material = row.material;
          const hay = [
            material.product_name,
            material.product_code,
            material.size_inches,
            material.steel_grade,
            material.manufacturer,
            material.model_number,
            material.project_number,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return hay.includes(needle);
        })
      : rows;
    return source.slice(0, 12);
  }, [rows, query]);

  function pickMaterial(row: OnHandRow) {
    setSelected(row);
    setCustom(false);
    const material = row.material;
    setQuery(material.product_code ? `${material.product_code} — ${material.product_name}` : material.product_name);
    const identity = splitHeatLotSerial(material.heat_lot_serial);
    setHeatNumber(identity.heat);
    setLotNumber(identity.lot);
    setSerialNumber(identity.serial);
    const short = Math.max(row.ordered - row.received, 0);
    setQuantity(short > 0 ? String(short) : "1");
    setProjectNumber(material.project_number ?? "");
    setConstructionOrder(material.construction_order ?? "");
    setOpen(false);
  }

  function useCustomLine() {
    setSelected(null);
    setCustom(true);
    setOpen(false);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    let material: Material | null = selected?.material ?? null;
    if (!material && custom) {
      const name = query.trim();
      if (!name) {
        setError("Enter the product or description.");
        return;
      }
      const created = await createMaterial(local, {
        product_name: name,
        description: name,
        project_number: projectNumber,
        construction_order: constructionOrder,
        ordered_qty: 0,
      });
      if ("error" in created) {
        setError(created.error);
        return;
      }
      material = created.material;
    }

    if (!material) {
      setError("Select a BOM line, or check this description in as a new line.");
      return;
    }
    if (material.heat_number_required && !heatNumber.trim() && !lotNumber.trim()) {
      setError("Enter the heat or lot number from the stencil.");
      return;
    }
    if (material.requires_serial && !serialNumber.trim()) {
      setError("Serial number is required for this product.");
      return;
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Quantity received must be a positive number.");
      return;
    }

    setBusy(true);
    const files: Array<{ file: File; docType: "packing_list" | "mtr" }> = [];
    if (docs.packingList) files.push({ file: docs.packingList, docType: "packing_list" });
    if (docs.mtr) files.push({ file: docs.mtr, docType: "mtr" });

    const saved = await saveCheckIn(local, {
      material,
      heatNumber,
      lotNumber,
      serialNumber,
      shipmentNumber,
      quantity: qty,
      notes,
      files,
    });
    setBusy(false);
    if ("error" in saved) {
      setError(saved.error);
      return;
    }
    navigate(docs.mtr ? `/inventory/${saved.id}` : `/inventory/${saved.id}?needMtr=1`);
  }

  const material = selected?.material;

  return (
    <PageShell
      title="Check in a delivery"
      description="Material just hit the yard. Pick the BOM line, enter the quantity received, heat / lot / serial, and attach the packing list or MTR if you have them."
      actions={
        <Link to="/packing-list" className="text-sm font-semibold text-[var(--accent)]">
          Confirm a whole packing list
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <Field
          label="Product / description"
          hint={
            loadingCatalog
              ? "Loading the BOM…"
              : rows.length
                ? "Search the bill of materials. You can also check in a description that is not on the BOM yet."
                : "The BOM is empty. You can still check this description in, or import a spreadsheet first."
          }
        >
          <div className="relative">
            <input
              className={inputClassName}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelected(null);
                setCustom(false);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder="Description, item, size, or heat"
              autoComplete="off"
              required
            />
            {open && (filtered.length > 0 || query.trim()) ? (
              <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-[var(--border)] bg-white shadow-md">
                {filtered.map((row) => (
                  <li key={row.material.id}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-start gap-0.5 px-3 py-3 text-left hover:bg-[var(--surface-2)]"
                      onClick={() => pickMaterial(row)}
                    >
                      <span className="text-sm font-medium">{row.material.product_name}</span>
                      <span className="text-xs text-[var(--muted)]">
                        {[
                          row.material.product_code,
                          row.material.size_inches ? `${row.material.size_inches} in` : "",
                          row.material.steel_grade,
                          jobLabel(row.material),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      <span className="font-mono text-xs text-[var(--muted)]">
                        On hand {formatQty(row.onHand)} · ordered {formatQty(row.ordered)}
                        {row.shortage > 0 ? ` · short ${formatQty(row.shortage)}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
                {query.trim() ? (
                  <li>
                    <button
                      type="button"
                      className="w-full px-3 py-3 text-left text-sm font-medium text-[var(--accent)] hover:bg-[var(--surface-2)]"
                      onClick={useCustomLine}
                    >
                      Check in “{query.trim()}” as a new line
                    </button>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
        </Field>

        {material ? (
          <div className="rounded-md bg-[var(--surface-2)] px-3 py-3 text-sm">
            <p className="font-medium text-[var(--ink)]">{material.product_name}</p>
            <p className="mt-1 text-[var(--muted)]">
              {[
                material.size_inches ? `${material.size_inches} in` : "",
                material.wall_sdr ? `wall ${material.wall_sdr}` : "",
                material.steel_grade,
                material.manufacturer,
                material.model_number,
                material.ansi_rating,
              ]
                .filter(Boolean)
                .join(" · ") || "No size / grade on the BOM"}
            </p>
            <p className="mt-1 text-[var(--muted)]">{jobLabel(material)}</p>
            {selected ? (
              <p className="mt-2 font-mono text-xs text-[var(--ink)]">
                On hand {formatQty(selected.onHand)} · ordered {formatQty(selected.ordered)} · issued{" "}
                {formatQty(selected.issued)} · remaining {formatQty(selected.remaining)}
              </p>
            ) : null}
            {selected && !selected.hasMtr ? (
              <p className="mt-2 text-xs text-[var(--warn)]">No MTR on file. You can request one after this receipt.</p>
            ) : null}
          </div>
        ) : null}

        {custom ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Project number" hint="Optional">
              <input className={inputClassName} value={projectNumber} onChange={(event) => setProjectNumber(event.target.value)} />
            </Field>
            <Field label="Construction order" hint="Optional">
              <input
                className={inputClassName}
                value={constructionOrder}
                onChange={(event) => setConstructionOrder(event.target.value)}
              />
            </Field>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Heat number">
            <input
              className={inputClassName}
              value={heatNumber}
              onChange={(event) => setHeatNumber(event.target.value)}
              placeholder="H-45219"
            />
          </Field>
          <Field label="Lot number">
            <input
              className={inputClassName}
              value={lotNumber}
              onChange={(event) => setLotNumber(event.target.value)}
              placeholder="If it is a lot, not a heat"
            />
          </Field>
          <Field label="Serial number" hint={material?.requires_serial ? "Required for this product." : "Optional"}>
            <input
              className={inputClassName}
              value={serialNumber}
              onChange={(event) => setSerialNumber(event.target.value)}
              placeholder="Valve or fitting serial"
            />
          </Field>
        </div>

        <Field label="Shipment # (MRC)" hint="Optional. Shows on the MTR request when the cert did not ship.">
          <input
            className={inputClassName}
            value={shipmentNumber}
            onChange={(event) => setShipmentNumber(event.target.value)}
            placeholder="MRC-1844"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Qty received" hint={material?.unit ? `Unit on the BOM: ${material.unit}` : "How much arrived"}>
            <input
              className={inputClassName}
              inputMode="decimal"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              required
            />
          </Field>
          <Field label="Notes" hint="Truck, yard, or packing-list exception">
            <input className={inputClassName} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Truck 18, yard 2" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Packing list" hint="Photo or PDF, if you have it">
            <input
              className={inputClassName}
              type="file"
              accept="application/pdf,image/*,.txt"
              onChange={(event) => setDocs((prev) => ({ ...prev, packingList: event.target.files?.[0] ?? null }))}
            />
          </Field>
          <Field label="MTR" hint="Leave empty to request the cert afterward">
            <input
              className={inputClassName}
              type="file"
              accept="application/pdf,image/*,.txt"
              onChange={(event) => setDocs((prev) => ({ ...prev, mtr: event.target.files?.[0] ?? null }))}
            />
          </Field>
        </div>

        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

        <PrimaryButton type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save check-in"}
        </PrimaryButton>
      </form>
    </PageShell>
  );
}
