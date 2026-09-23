import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useGuestData } from "@/auth/auth-context";
import { OnHandSheet } from "@/components/on-hand-sheet";
import { PageShell } from "@/components/page-shell";
import { inputClassName } from "@/components/ui";
import { loadOnHand } from "@/lib/app-data";
import { QTY_LEGEND, jobLabel, type OnHandRow } from "@/lib/quantities";

type Focus = "all" | "short" | "mtr";

export function InventoryPage() {
  const local = useGuestData();
  const location = useLocation();
  const notice = (location.state as { notice?: string } | null)?.notice;
  const [rows, setRows] = useState<OnHandRow[]>([]);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [project, setProject] = useState("all");
  const [focus, setFocus] = useState<Focus>("all");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const result = await loadOnHand(local);
      if (cancelled) return;
      setError(result.error);
      setRows(result.rows);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [local, reloadKey]);

  const projects = useMemo(() => {
    const labels = new Set(rows.map((row) => jobLabel(row.material)));
    return [...labels];
  }, [rows]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (project !== "all" && jobLabel(row.material) !== project) return false;
      if (focus === "short" && row.shortage <= 0) return false;
      if (focus === "mtr" && (row.hasMtr || row.received <= 0)) return false;
      if (!needle) return true;
      const hay = [
        row.material.product_name,
        row.material.product_code,
        row.material.size_inches,
        row.material.steel_grade,
        row.material.manufacturer,
        row.material.model_number,
        row.material.project_number,
        row.material.construction_order,
        row.material.heat_lot_serial,
        ...row.checkIns.flatMap((checkIn) => [checkIn.heat_number, checkIn.lot_number, checkIn.serial_number]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, query, project, focus]);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    setQuery(draft.trim());
  }

  return (
    <PageShell
      wide
      title="Materials on hand"
      description="Each BOM line shows what is in the yard, what the job ordered, what has been issued, and what is still remaining."
    >
      {notice ? <p className="rounded-md bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--ink)]">{notice}</p> : null}
      <p className="text-sm text-[var(--muted)]">{QTY_LEGEND}</p>
      <form className="grid gap-2 sm:grid-cols-[1fr_auto_auto]" onSubmit={onSearch}>
        <input
          className={inputClassName}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Search description, heat, lot, serial, project"
        />
        <select className={inputClassName} value={project} onChange={(event) => setProject(event.target.value)}>
          <option value="all">All jobs</option>
          {projects.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="min-h-11 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
        >
          Search
        </button>
      </form>
      <div className="flex flex-wrap gap-2">
        <FilterChip active={focus === "all"} onClick={() => setFocus("all")}>
          All lines
        </FilterChip>
        <FilterChip active={focus === "short"} onClick={() => setFocus("short")}>
          Shortages
        </FilterChip>
        <FilterChip active={focus === "mtr"} onClick={() => setFocus("mtr")}>
          Needs MTR
        </FilterChip>
      </div>

      {error ? (
        <p className="text-sm text-[var(--danger)]">{error}</p>
      ) : loading ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : !visible.length ? (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-sm text-[var(--muted)]">
          {rows.length
            ? "Nothing matches that filter."
            : "No materials yet. Import a BOM, then confirm the packing list or check in a delivery."}
        </p>
      ) : (
        <OnHandSheet rows={visible} onChanged={() => setReloadKey((value) => value + 1)} />
      )}
    </PageShell>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 rounded-full px-4 text-sm font-semibold ${
        active ? "bg-[var(--accent)] text-white" : "border border-[var(--border)] bg-white text-[var(--ink)]"
      }`}
    >
      {children}
    </button>
  );
}
