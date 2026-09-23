import type {
  CheckIn,
  DocumentRow,
  Material,
  MaterialIssue,
  PackingListStatus,
} from "@/lib/database.types";

export function asQty(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function formatQty(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 1000) / 1000;
  return rounded.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

/** Remaining to consume on the job. Falls back to on-hand when the BOM has no order qty. */
export function remainingQty(ordered: number, issued: number, onHand: number): number {
  if (ordered > 0) return ordered - issued;
  return onHand;
}

export function derivePackingStatus(
  ordered: number,
  received: number,
  markedMissing: boolean,
): PackingListStatus {
  if (received <= 0 && markedMissing) return "missing";
  if (received <= 0) return "pending";
  if (ordered > 0 && received + 1e-9 < ordered) return "partial";
  return "full";
}

export type QtyRollup = {
  ordered: number;
  received: number;
  issued: number;
  onHand: number;
  remaining: number;
  shortage: number;
};

export function rollupQuantities(
  material: Pick<Material, "id" | "ordered_qty" | "issued_qty">,
  checkIns: Pick<CheckIn, "material_id" | "quantity">[],
  issues: Pick<MaterialIssue, "material_id" | "quantity">[],
): QtyRollup {
  const ordered = asQty(material.ordered_qty);
  const received = checkIns
    .filter((row) => row.material_id === material.id)
    .reduce((sum, row) => sum + asQty(row.quantity), 0);
  const issueRows = issues.filter((row) => row.material_id === material.id);
  const issued = issueRows.length
    ? issueRows.reduce((sum, row) => sum + asQty(row.quantity), 0)
    : asQty(material.issued_qty);
  const onHand = received - issued;
  return {
    ordered,
    received,
    issued,
    onHand,
    remaining: remainingQty(ordered, issued, onHand),
    shortage: ordered > 0 ? Math.max(ordered - received, 0) : 0,
  };
}

export type OnHandRow = {
  material: Material;
  ordered: number;
  received: number;
  issued: number;
  onHand: number;
  remaining: number;
  shortage: number;
  hasMtr: boolean;
  status: PackingListStatus;
  latestCheckIn: CheckIn | null;
  checkIns: CheckIn[];
  documents: DocumentRow[];
  issues: MaterialIssue[];
};

export function jobKey(material: Pick<Material, "project_number" | "construction_order">) {
  return `${material.project_number ?? ""}||${material.construction_order ?? ""}`;
}

export function jobLabel(material: Pick<Material, "project_number" | "construction_order">) {
  const parts = [
    material.project_number ? `Project ${material.project_number}` : "",
    material.construction_order ? `CO ${material.construction_order}` : "",
  ].filter(Boolean);
  return parts.join(" · ") || "No project on the BOM";
}

export function buildOnHandRows(
  materials: Material[],
  checkIns: CheckIn[],
  documents: DocumentRow[],
  issues: MaterialIssue[],
): OnHandRow[] {
  const docsByCheckIn = new Map<string, DocumentRow[]>();
  for (const doc of documents) {
    const list = docsByCheckIn.get(doc.check_in_id) ?? [];
    list.push(doc);
    docsByCheckIn.set(doc.check_in_id, list);
  }

  return materials
    .map((material) => {
      const lineCheckIns = checkIns
        .filter((row) => row.material_id === material.id)
        .sort((a, b) => b.received_at.localeCompare(a.received_at));
      const lineDocs = lineCheckIns.flatMap((row) => docsByCheckIn.get(row.id) ?? []);
      const lineIssues = issues
        .filter((row) => row.material_id === material.id)
        .sort((a, b) => b.issued_at.localeCompare(a.issued_at));
      const qty = rollupQuantities(material, lineCheckIns, lineIssues);
      const markedMissing = material.packing_list_status === "missing" && qty.received <= 0;
      return {
        material,
        ...qty,
        hasMtr: lineDocs.some((doc) => doc.doc_type === "mtr"),
        status: derivePackingStatus(qty.ordered, qty.received, markedMissing),
        latestCheckIn: lineCheckIns[0] ?? null,
        checkIns: lineCheckIns,
        documents: lineDocs,
        issues: lineIssues,
      };
    })
    .sort((a, b) => {
      const job = jobLabel(a.material).localeCompare(jobLabel(b.material));
      if (job) return job;
      return (a.material.product_code ?? a.material.product_name).localeCompare(
        b.material.product_code ?? b.material.product_name,
        undefined,
        { numeric: true },
      );
    });
}

export function splitHeatLotSerial(value: string | null | undefined): {
  heat: string;
  lot: string;
  serial: string;
} {
  const raw = (value ?? "").trim();
  if (!raw) return { heat: "", lot: "", serial: "" };
  const heat = raw.match(/heat\s*(?:no|number|#)?\s*[:#-]?\s*([a-z0-9-]+)/i)?.[1] ?? "";
  const lot = raw.match(/lot\s*(?:no|number|#)?\s*[:#-]?\s*([a-z0-9-]+)/i)?.[1] ?? "";
  const serial = raw.match(/(?:serial|s\/n|sn)\s*(?:no|number|#)?\s*[:#-]?\s*([a-z0-9-]+)/i)?.[1] ?? "";
  if (heat || lot || serial) return { heat, lot, serial };
  return { heat: raw, lot: "", serial: "" };
}

export const QTY_LEGEND =
  "On hand = received − issued. Ordered is the BOM quantity for the job. Issued is what has gone out to the job. Remaining = ordered − issued when the line has an order qty; otherwise remaining equals on hand. A shortage means received is still under the ordered qty.";
