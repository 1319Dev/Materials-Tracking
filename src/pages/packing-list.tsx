import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGuestData } from "@/auth/auth-context";
import { PageShell } from "@/components/page-shell";
import { Field, PrimaryButton, SecondaryButton, inputClassName } from "@/components/ui";
import { confirmPackingList, loadOnHand } from "@/lib/app-data";
import type { ConfirmLineInput } from "@/lib/guest-store";
import { formatQty, jobLabel, splitHeatLotSerial, type OnHandRow } from "@/lib/quantities";

type Choice = "full" | "partial" | "missing";

type Draft = {
  choice: Choice | null;
  quantity: string;
  heat: string;
  lot: string;
  serial: string;
  mtr: File | null;
};

function emptyDraft(row: OnHandRow): Draft {
  const identity = splitHeatLotSerial(row.material.heat_lot_serial);
  const latest = row.latestCheckIn;
  return {
    choice: null,
    quantity: "",
    heat: latest && latest.heat_number !== "N/A" ? latest.heat_number : identity.heat,
    lot: latest?.lot_number || identity.lot,
    serial: latest?.serial_number || identity.serial,
    mtr: null,
  };
}

export function PackingListPage() {
  const navigate = useNavigate();
  const local = useGuestData();
  const [rows, setRows] = useState<OnHandRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [project, setProject] = useState("all");
  const [packingList, setPackingList] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await loadOnHand(local);
      if (cancelled) return;
      setError(result.error);
      setRows(result.rows);
      setDrafts((prev) => {
        const next = { ...prev };
        for (const row of result.rows) {
          if (!next[row.material.id]) next[row.material.id] = emptyDraft(row);
        }
        return next;
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [local]);

  const projects = useMemo(() => [...new Set(rows.map((row) => jobLabel(row.material)))], [rows]);
  const visible = rows.filter((row) => project === "all" || jobLabel(row.material) === project);

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((prev) => {
      const row = rows.find((entry) => entry.material.id === id);
      const base =
        prev[id] ??
        (row
          ? emptyDraft(row)
          : { choice: null, quantity: "", heat: "", lot: "", serial: "", mtr: null });
      return { ...prev, [id]: { ...base, ...patch } };
    });
  }

  function choose(row: OnHandRow, choice: Choice) {
    const current = drafts[row.material.id] ?? emptyDraft(row);
    const stillDue = Math.max(row.ordered - row.received, 0);
    if (choice === "missing") {
      updateDraft(row.material.id, { choice, quantity: "0" });
      return;
    }
    if (choice === "full") {
      updateDraft(row.material.id, {
        choice,
        quantity: stillDue > 0 ? String(stillDue) : current.quantity || "",
      });
      return;
    }
    const currentQty = Number(current.quantity);
    const clear = !current.quantity || (stillDue > 0 && currentQty >= stillDue);
    updateDraft(row.material.id, { choice, quantity: clear ? "" : current.quantity });
  }

  function receiveAll() {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const row of visible) {
        const stillDue = Math.max(row.ordered - row.received, 0);
        if (stillDue <= 0) continue;
        const current = next[row.material.id] ?? emptyDraft(row);
        if (current.choice === "missing") continue;
        next[row.material.id] = { ...current, choice: "full", quantity: String(stillDue) };
      }
      return next;
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const lines: ConfirmLineInput[] = [];
    for (const row of visible) {
      const draft = drafts[row.material.id];
      if (!draft?.choice) continue;
      if (draft.choice === "missing") {
        lines.push({
          materialId: row.material.id,
          quantity: 0,
          status: "missing",
          heatNumber: draft.heat,
          lotNumber: draft.lot,
          serialNumber: draft.serial,
          mtrFile: null,
        });
        continue;
      }
      const quantity = Number(draft.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        setError(
          draft.choice === "partial"
            ? `Enter the quantity received for ${row.material.product_name}.`
            : `${row.material.product_name} is already received in full. Enter an extra quantity or skip it.`,
        );
        return;
      }
      lines.push({
        materialId: row.material.id,
        quantity,
        status: draft.choice,
        heatNumber: draft.heat,
        lotNumber: draft.lot,
        serialNumber: draft.serial,
        mtrFile: draft.mtr,
      });
    }

    if (!lines.length) {
      setError("Mark at least one line full, partial, or missing.");
      return;
    }

    setBusy(true);
    const saved = await confirmPackingList(local, { lines, packingList, notes });
    setBusy(false);
    if ("error" in saved) {
      setError(saved.error);
      return;
    }
    const summary = [
      saved.created ? `${saved.created} receipt${saved.created === 1 ? "" : "s"} posted to on hand` : "",
      saved.missing ? `${saved.missing} flagged not on this shipment` : "",
    ]
      .filter(Boolean)
      .join(". ");
    navigate("/inventory", { state: { notice: summary } });
  }

  return (
    <PageShell
      title="Confirm the packing list"
      description="Compare each BOM line with what was on the truck. Mark it received in full, partial, or missing. Confirmed quantities become check-ins and update on hand."
    >
      {loading ? <p className="text-sm text-[var(--muted)]">Loading the BOM…</p> : null}
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      {!loading && !rows.length ? (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-sm text-[var(--muted)]">
          Import a bill of materials first, then come back to confirm the shipment.
        </p>
      ) : null}

      {rows.length ? (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select className={`${inputClassName} sm:max-w-xs`} value={project} onChange={(event) => setProject(event.target.value)}>
              <option value="all">All jobs</option>
              {projects.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
            <SecondaryButton type="button" onClick={receiveAll}>
              Receive all remaining in full
            </SecondaryButton>
          </div>

          <div className="space-y-3">
            {visible.map((row) => {
              const draft = drafts[row.material.id] ?? emptyDraft(row);
              const material = row.material;
              return (
                <article key={material.id} className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      {[material.product_code, jobLabel(material)].filter(Boolean).join(" · ")}
                    </p>
                    <h2 className="text-base font-semibold text-[var(--ink)]">{material.product_name}</h2>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {[
                        material.size_inches ? `${material.size_inches} in` : "",
                        material.wall_sdr ? `wall ${material.wall_sdr}` : "",
                        material.steel_grade,
                        material.manufacturer,
                        material.model_number,
                        material.ansi_rating,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="mt-2 font-mono text-xs text-[var(--ink)]">
                      Expected {formatQty(row.ordered)}
                      {material.unit && material.unit !== "ea" ? ` ${material.unit}` : ""} · received {formatQty(row.received)}
                      {row.shortage > 0 ? ` · short ${formatQty(row.shortage)}` : ""}
                    </p>
                  </div>

                  <Field label="Qty this receipt">
                    <input
                      className={inputClassName}
                      inputMode="decimal"
                      value={draft.quantity}
                      onChange={(event) => updateDraft(material.id, { quantity: event.target.value, choice: draft.choice ?? "partial" })}
                    />
                  </Field>
                  <div className="grid grid-cols-3 gap-2">
                    <ChoiceButton active={draft.choice === "full"} onClick={() => choose(row, "full")}>
                      Full
                    </ChoiceButton>
                    <ChoiceButton active={draft.choice === "partial"} onClick={() => choose(row, "partial")}>
                      Partial
                    </ChoiceButton>
                    <ChoiceButton active={draft.choice === "missing"} onClick={() => choose(row, "missing")}>
                      Missing
                    </ChoiceButton>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Heat">
                      <input className={inputClassName} value={draft.heat} onChange={(event) => updateDraft(material.id, { heat: event.target.value })} />
                    </Field>
                    <Field label="Lot">
                      <input className={inputClassName} value={draft.lot} onChange={(event) => updateDraft(material.id, { lot: event.target.value })} />
                    </Field>
                    <Field label="Serial">
                      <input
                        className={inputClassName}
                        value={draft.serial}
                        onChange={(event) => updateDraft(material.id, { serial: event.target.value })}
                      />
                    </Field>
                  </div>
                  <Field label="MTR for this line" hint="Optional. Leave empty if the cert did not ship.">
                    <input
                      className={inputClassName}
                      type="file"
                      accept="application/pdf,image/*,.txt"
                      onChange={(event) => updateDraft(material.id, { mtr: event.target.files?.[0] ?? null })}
                    />
                  </Field>
                </article>
              );
            })}
          </div>

          <section className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
            <Field label="Packing list for this receipt" hint="One photo or PDF, attached to each line you receive">
              <input
                className={inputClassName}
                type="file"
                accept="application/pdf,image/*,.txt"
                onChange={(event) => setPackingList(event.target.files?.[0] ?? null)}
              />
            </Field>
            <Field label="Receipt notes" hint="Truck, yard, or who checked it">
              <input className={inputClassName} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Truck 18, yard 2" />
            </Field>
            <PrimaryButton type="submit" disabled={busy}>
              {busy ? "Posting…" : "Post receipt to on hand"}
            </PrimaryButton>
          </section>
        </form>
      ) : null}
    </PageShell>
  );
}

function ChoiceButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-11 rounded-md border px-2 text-sm font-semibold ${
        active
          ? "border-[var(--accent)] bg-[var(--accent)] text-white"
          : "border-[var(--border)] bg-white text-[var(--ink)]"
      }`}
    >
      {children}
    </button>
  );
}
