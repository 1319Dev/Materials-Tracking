import type {
  CheckIn,
  DocumentRow,
  Json,
  Material,
  MaterialIssue,
  PackingListStatus,
} from "@/lib/database.types";
import { createDemoGuestData, type GuestData } from "@/lib/demo-data";
import { derivePackingStatus, rollupQuantities } from "@/lib/quantities";
import type { MappedMaterialRow } from "@/lib/spreadsheet";

const MODE_KEY = "materials-tracking-guest";
const DATA_KEY = "materials-tracking-guest-data";
const GUEST_USER_ID = "guest";
const MAX_PERSISTED_DATA_URL = 350_000;

const memoryUrls = new Map<string, string>();
let memoryData: GuestData | null = null;
let memoryMode = false;

export type GuestMaterialDraft = {
  product_name: string;
  product_code?: string | null;
  description?: string | null;
  size_inches?: string | null;
  wall_sdr?: string | null;
  steel_grade?: string | null;
  manufacturer?: string | null;
  model_number?: string | null;
  ansi_rating?: string | null;
  heat_lot_serial?: string | null;
  project_number?: string | null;
  construction_order?: string | null;
  ordered_qty?: number;
  unit?: string | null;
  requires_serial?: boolean;
  heat_number_required?: boolean;
};

export type ConfirmLineInput = {
  materialId: string;
  quantity: number;
  status: "full" | "partial" | "missing";
  heatNumber: string;
  lotNumber: string;
  serialNumber: string;
  mtrFile: File | null;
};

function storageGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function storageRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* private mode or blocked storage */
  }
}

export function guestModeEnabled() {
  return memoryMode || storageGet(MODE_KEY) === "1";
}

export function enableGuestMode() {
  memoryMode = true;
  storageSet(MODE_KEY, "1");
  ensureGuestData();
}

export function disableGuestMode() {
  memoryMode = false;
  storageRemove(MODE_KEY);
}

function cloneData(data: GuestData): GuestData {
  return structuredClone(data);
}

function asStatus(value: unknown): PackingListStatus {
  if (value === "full" || value === "partial" || value === "missing" || value === "pending") return value;
  return "pending";
}

function normalizeMaterial(row: Partial<Material> & Pick<Material, "id" | "product_name">): Material {
  const now = new Date().toISOString();
  const size = row.size_inches ?? row.size ?? null;
  const grade = row.steel_grade ?? row.material_grade ?? null;
  return {
    id: row.id,
    user_id: row.user_id ?? GUEST_USER_ID,
    product_code: row.product_code ?? null,
    product_name: row.product_name,
    description: row.description ?? null,
    size,
    size_inches: size,
    material_grade: grade,
    steel_grade: grade,
    wall_sdr: row.wall_sdr ?? null,
    manufacturer: row.manufacturer ?? null,
    model_number: row.model_number ?? null,
    ansi_rating: row.ansi_rating ?? null,
    heat_lot_serial: row.heat_lot_serial ?? null,
    project_number: row.project_number ?? null,
    construction_order: row.construction_order ?? null,
    ordered_qty: Number(row.ordered_qty ?? 0) || 0,
    issued_qty: Number(row.issued_qty ?? 0) || 0,
    unit: row.unit ?? "ea",
    requires_serial: Boolean(row.requires_serial),
    heat_number_required: row.heat_number_required ?? true,
    packing_list_status: asStatus(row.packing_list_status),
    import_batch_id: row.import_batch_id ?? null,
    source_row: row.source_row ?? null,
    created_at: row.created_at ?? now,
    updated_at: row.updated_at ?? now,
  };
}

function normalizeCheckIn(row: CheckIn): CheckIn {
  return {
    ...row,
    lot_number: row.lot_number ?? null,
    shipment_number:
      row.shipment_number ?? (row.id === "demo-ci-valve-8" ? "MRC-1844" : null),
    quantity: Number(row.quantity) || 0,
  };
}

function normalizeGuestData(raw: {
  materials?: unknown;
  checkIns?: unknown;
  documents?: unknown;
  issues?: unknown;
}): GuestData {
  const materials = Array.isArray(raw.materials)
    ? raw.materials.map((row) => normalizeMaterial(row as Material))
    : [];
  const checkIns = Array.isArray(raw.checkIns) ? raw.checkIns.map((row) => normalizeCheckIn(row as CheckIn)) : [];
  const documents = Array.isArray(raw.documents) ? (raw.documents as DocumentRow[]) : [];
  const issues = Array.isArray(raw.issues) ? (raw.issues as MaterialIssue[]) : [];
  return { version: 2, materials, checkIns, documents, issues };
}

function readDisk(): GuestData | null {
  const raw = storageGet(DATA_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      version?: number;
      materials?: unknown;
      checkIns?: unknown;
      documents?: unknown;
      issues?: unknown;
    };
    if ((parsed.version !== 1 && parsed.version !== 2) || !Array.isArray(parsed.materials)) return null;
    if (!Array.isArray(parsed.checkIns)) return null;
    return normalizeGuestData(parsed);
  } catch {
    return null;
  }
}

function persist(data: GuestData) {
  const normalized = normalizeGuestData(data);
  memoryData = cloneData(normalized);
  if (storageSet(DATA_KEY, JSON.stringify(normalized))) return;

  const slim: GuestData = {
    ...normalized,
    documents: normalized.documents.map((doc) =>
      doc.storage_path.startsWith("data:") && doc.storage_path.length > 500
        ? { ...doc, storage_path: `memory:${doc.id}` }
        : doc,
    ),
  };
  memoryData = cloneData(slim);
  storageSet(DATA_KEY, JSON.stringify(slim));
}

export function ensureGuestData() {
  if (memoryData || readDisk()) return;
  persist(createDemoGuestData());
}

export function readGuestData(): GuestData {
  ensureGuestData();
  if (memoryData) return cloneData(memoryData);
  const disk = readDisk();
  if (disk) {
    memoryData = disk;
    return cloneData(disk);
  }
  const seeded = createDemoGuestData();
  persist(seeded);
  return cloneData(seeded);
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export async function guestDocumentHref(doc: Pick<DocumentRow, "id" | "storage_path">) {
  const cached = memoryUrls.get(doc.id);
  if (cached) return cached;
  if (!doc.storage_path.startsWith("data:")) return null;
  const response = await fetch(doc.storage_path);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  memoryUrls.set(doc.id, url);
  return url;
}

async function storeFile(docId: string, file: File) {
  memoryUrls.set(docId, URL.createObjectURL(file));
  if (file.size > MAX_PERSISTED_DATA_URL) return `memory:${docId}`;
  try {
    return await readAsDataUrl(file);
  } catch {
    return `memory:${docId}`;
  }
}

function refreshStatus(data: GuestData, material: Material, markedMissing = false) {
  const qty = rollupQuantities(material, data.checkIns, data.issues);
  material.packing_list_status = derivePackingStatus(
    qty.ordered,
    qty.received,
    markedMissing || (material.packing_list_status === "missing" && qty.received <= 0),
  );
  material.issued_qty = qty.issued;
}

function findImportedMaterial(materials: Material[], row: MappedMaterialRow) {
  const code = row.product_code?.toLowerCase() ?? "";
  const project = (row.project_number ?? "").toLowerCase();
  const order = (row.construction_order ?? "").toLowerCase();
  if (code) {
    const byCode = materials.filter((material) => material.product_code?.toLowerCase() === code);
    const scoped = byCode.filter((material) => {
      const sameProject = !project || (material.project_number ?? "").toLowerCase() === project;
      const sameOrder = !order || (material.construction_order ?? "").toLowerCase() === order;
      return sameProject && sameOrder;
    });
    if (scoped[0]) return scoped[0];
    if (!project && !order && byCode[0]) return byCode[0];
  }
  return materials.find((material) => {
    const sameName = material.product_name.toLowerCase() === row.product_name.toLowerCase();
    const sameProject = !project || (material.project_number ?? "").toLowerCase() === project;
    return sameName && sameProject;
  });
}

function keepText(next: string | null, previous: string | null) {
  return next ? next : previous;
}

function applyMapped(target: Material, row: MappedMaterialRow, now: string) {
  const size = keepText(row.size_inches ?? row.size, target.size_inches ?? target.size);
  const grade = keepText(row.steel_grade ?? row.material_grade, target.steel_grade ?? target.material_grade);
  target.product_code = keepText(row.product_code, target.product_code);
  target.product_name = row.product_name;
  target.description = keepText(row.description, target.description);
  target.size = size;
  target.size_inches = size;
  target.material_grade = grade;
  target.steel_grade = grade;
  target.wall_sdr = keepText(row.wall_sdr, target.wall_sdr);
  target.manufacturer = keepText(row.manufacturer, target.manufacturer);
  target.model_number = keepText(row.model_number, target.model_number);
  target.ansi_rating = keepText(row.ansi_rating, target.ansi_rating);
  target.heat_lot_serial = keepText(row.heat_lot_serial, target.heat_lot_serial);
  if (row.project_number) target.project_number = row.project_number;
  if (row.construction_order) target.construction_order = row.construction_order;
  if (row.ordered_qty != null) target.ordered_qty = row.ordered_qty;
  if (row.unit) target.unit = row.unit;
  if (row.requires_serial != null) target.requires_serial = row.requires_serial;
  if (row.heat_number_required != null) target.heat_number_required = row.heat_number_required;
  target.source_row = row.source_row as Json;
  target.updated_at = now;
}

export function importGuestCatalog(mapped: MappedMaterialRow[]) {
  const data = readGuestData();
  const now = new Date().toISOString();
  const batchId = crypto.randomUUID();
  let inserted = 0;
  let updated = 0;

  for (const row of mapped) {
    const existing = findImportedMaterial(data.materials, row);
    if (existing) {
      applyMapped(existing, row, now);
      existing.import_batch_id = batchId;
      refreshStatus(data, existing);
      updated += 1;
      continue;
    }

    const created = normalizeMaterial({
      id: crypto.randomUUID(),
      user_id: GUEST_USER_ID,
      product_name: row.product_name,
      created_at: now,
    });
    applyMapped(created, row, now);
    created.import_batch_id = batchId;
    created.created_at = now;
    created.packing_list_status = "pending";
    data.materials.push(created);
    inserted += 1;
  }

  data.materials.sort((a, b) => a.product_name.localeCompare(b.product_name));
  persist(data);
  return { inserted, updated };
}

export function createGuestMaterial(draft: GuestMaterialDraft) {
  const data = readGuestData();
  const now = new Date().toISOString();
  const size = draft.size_inches?.trim() || null;
  const grade = draft.steel_grade?.trim() || null;
  const material = normalizeMaterial({
    id: crypto.randomUUID(),
    user_id: GUEST_USER_ID,
    product_code: draft.product_code?.trim() || null,
    product_name: draft.product_name.trim(),
    description: draft.description?.trim() || draft.product_name.trim(),
    size,
    size_inches: size,
    material_grade: grade,
    steel_grade: grade,
    wall_sdr: draft.wall_sdr?.trim() || null,
    manufacturer: draft.manufacturer?.trim() || null,
    model_number: draft.model_number?.trim() || null,
    ansi_rating: draft.ansi_rating?.trim() || null,
    heat_lot_serial: draft.heat_lot_serial?.trim() || null,
    project_number: draft.project_number?.trim() || null,
    construction_order: draft.construction_order?.trim() || null,
    ordered_qty: draft.ordered_qty ?? 0,
    issued_qty: 0,
    unit: draft.unit?.trim() || "ea",
    requires_serial: draft.requires_serial ?? false,
    heat_number_required: draft.heat_number_required ?? true,
    packing_list_status: "pending",
    created_at: now,
    updated_at: now,
    source_row: null,
    import_batch_id: null,
  });
  data.materials.push(material);
  persist(data);
  return material;
}

async function attachDocument(
  data: GuestData,
  checkInId: string,
  file: File,
  docType: DocumentRow["doc_type"],
  now: string,
  storagePath?: string,
) {
  const docId = crypto.randomUUID();
  const path = storagePath ?? (await storeFile(docId, file));
  if (!storagePath) memoryUrls.set(docId, memoryUrls.get(docId) ?? URL.createObjectURL(file));
  data.documents.push({
    id: docId,
    user_id: GUEST_USER_ID,
    check_in_id: checkInId,
    doc_type: docType,
    file_name: file.name,
    mime_type: file.type || null,
    storage_path: path,
    created_at: now,
  });
  return path;
}

export async function addGuestCheckIn(input: {
  material: Material;
  heatNumber: string;
  lotNumber: string;
  serialNumber: string;
  shipmentNumber: string;
  quantity: number;
  notes: string;
  files: Array<{ file: File; docType: DocumentRow["doc_type"] }>;
}) {
  const data = readGuestData();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const material = data.materials.find((row) => row.id === input.material.id);
  const checkIn: CheckIn = {
    id,
    user_id: GUEST_USER_ID,
    material_id: input.material.id,
    product_name: input.material.product_name,
    product_code: input.material.product_code,
    heat_number: input.heatNumber.trim() || "N/A",
    lot_number: input.lotNumber.trim() || null,
    serial_number: input.serialNumber.trim() || null,
    shipment_number: input.shipmentNumber.trim() || null,
    quantity: input.quantity,
    notes: input.notes.trim() || null,
    received_at: now,
    created_at: now,
  };
  data.checkIns.unshift(checkIn);

  for (const upload of input.files) {
    await attachDocument(data, id, upload.file, upload.docType, now);
  }

  if (material) {
    if (input.heatNumber.trim() || input.lotNumber.trim() || input.serialNumber.trim()) {
      const parts = [
        input.heatNumber.trim() ? `Heat ${input.heatNumber.trim()}` : "",
        input.lotNumber.trim() ? `Lot ${input.lotNumber.trim()}` : "",
        input.serialNumber.trim() ? `SN ${input.serialNumber.trim()}` : "",
      ].filter(Boolean);
      material.heat_lot_serial = parts.join(" / ") || material.heat_lot_serial;
    }
    refreshStatus(data, material, false);
    material.updated_at = now;
  }

  persist(data);
  return { id };
}

export async function confirmGuestReceipt(input: {
  lines: ConfirmLineInput[];
  packingList: File | null;
  notes: string;
  shipmentNumber: string;
}) {
  const data = readGuestData();
  const now = new Date().toISOString();
  const checkInIds: string[] = [];
  let missing = 0;
  let packingPath: string | null = null;

  if (input.packingList) {
    const holderId = crypto.randomUUID();
    packingPath = await storeFile(holderId, input.packingList);
    memoryUrls.set(holderId, memoryUrls.get(holderId) ?? URL.createObjectURL(input.packingList));
  }

  for (const line of input.lines) {
    const material = data.materials.find((row) => row.id === line.materialId);
    if (!material) continue;

    if (line.status === "missing") {
      refreshStatus(data, material, true);
      material.updated_at = now;
      missing += 1;
      continue;
    }

    if (line.quantity <= 0) continue;

    const id = crypto.randomUUID();
    data.checkIns.unshift({
      id,
      user_id: GUEST_USER_ID,
      material_id: material.id,
      product_name: material.product_name,
      product_code: material.product_code,
      heat_number: line.heatNumber.trim() || "N/A",
      lot_number: line.lotNumber.trim() || null,
      serial_number: line.serialNumber.trim() || null,
      shipment_number: input.shipmentNumber.trim() || null,
      quantity: line.quantity,
      notes: input.notes.trim() || "Packing list confirmation",
      received_at: now,
      created_at: now,
    });
    checkInIds.push(id);

    if (input.packingList && packingPath) {
      const docId = crypto.randomUUID();
      memoryUrls.set(docId, URL.createObjectURL(input.packingList));
      data.documents.push({
        id: docId,
        user_id: GUEST_USER_ID,
        check_in_id: id,
        doc_type: "packing_list",
        file_name: input.packingList.name,
        mime_type: input.packingList.type || null,
        storage_path: packingPath,
        created_at: now,
      });
    }
    if (line.mtrFile) await attachDocument(data, id, line.mtrFile, "mtr", now);

    const parts = [
      line.heatNumber.trim() ? `Heat ${line.heatNumber.trim()}` : "",
      line.lotNumber.trim() ? `Lot ${line.lotNumber.trim()}` : "",
      line.serialNumber.trim() ? `SN ${line.serialNumber.trim()}` : "",
    ].filter(Boolean);
    if (parts.length) material.heat_lot_serial = parts.join(" / ");
    refreshStatus(data, material, false);
    material.updated_at = now;
  }

  persist(data);
  return { created: checkInIds.length, missing, checkInIds };
}

export function issueGuestMaterial(input: { materialId: string; quantity: number; notes: string }) {
  const data = readGuestData();
  const material = data.materials.find((row) => row.id === input.materialId);
  if (!material) return { error: "That material is not on this device." };
  const qty = rollupQuantities(material, data.checkIns, data.issues);
  if (input.quantity > qty.onHand + 1e-9) {
    return { error: `Only ${qty.onHand} on hand. Issue a smaller quantity.` };
  }
  const now = new Date().toISOString();
  const issue: MaterialIssue = {
    id: crypto.randomUUID(),
    user_id: GUEST_USER_ID,
    material_id: material.id,
    quantity: input.quantity,
    notes: input.notes.trim() || null,
    project_number: material.project_number,
    construction_order: material.construction_order,
    issued_at: now,
    created_at: now,
  };
  data.issues.unshift(issue);
  material.issued_qty = qty.issued + input.quantity;
  material.updated_at = now;
  persist(data);
  return { id: issue.id };
}
