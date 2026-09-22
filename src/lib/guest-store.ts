import type { CheckIn, DocumentRow, Json, Material } from "@/lib/database.types";
import { createDemoGuestData, type GuestData } from "@/lib/demo-data";
import type { MappedMaterialRow } from "@/lib/spreadsheet";

const MODE_KEY = "materials-tracking-guest";
const DATA_KEY = "materials-tracking-guest-data";
const GUEST_USER_ID = "guest";
const MAX_PERSISTED_DATA_URL = 350_000;

const memoryUrls = new Map<string, string>();
let memoryData: GuestData | null = null;
let memoryMode = false;

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

function readDisk(): GuestData | null {
  const raw = storageGet(DATA_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as GuestData;
    if (parsed?.version !== 1 || !Array.isArray(parsed.materials) || !Array.isArray(parsed.checkIns)) {
      return null;
    }
    if (!Array.isArray(parsed.documents)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persist(data: GuestData) {
  memoryData = cloneData(data);
  if (storageSet(DATA_KEY, JSON.stringify(data))) return;

  const slim: GuestData = {
    ...data,
    documents: data.documents.map((doc) =>
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

export function importGuestCatalog(mapped: MappedMaterialRow[]) {
  const data = readGuestData();
  const now = new Date().toISOString();
  const batchId = crypto.randomUUID();
  let inserted = 0;
  let updated = 0;

  for (const row of mapped) {
    const existing =
      (row.product_code
        ? data.materials.find(
            (material) => material.product_code?.toLowerCase() === row.product_code?.toLowerCase(),
          )
        : undefined) ??
      data.materials.find((material) => material.product_name.toLowerCase() === row.product_name.toLowerCase());

    const sourceRow = row.source_row as Json;
    if (existing) {
      existing.product_code = row.product_code;
      existing.product_name = row.product_name;
      existing.description = row.description;
      existing.size = row.size;
      existing.material_grade = row.material_grade;
      existing.manufacturer = row.manufacturer;
      existing.unit = row.unit;
      existing.requires_serial = row.requires_serial;
      existing.heat_number_required = row.heat_number_required;
      existing.import_batch_id = batchId;
      existing.source_row = sourceRow;
      existing.updated_at = now;
      updated += 1;
    } else {
      const created: Material = {
        id: crypto.randomUUID(),
        user_id: GUEST_USER_ID,
        product_code: row.product_code,
        product_name: row.product_name,
        description: row.description,
        size: row.size,
        material_grade: row.material_grade,
        manufacturer: row.manufacturer,
        unit: row.unit,
        requires_serial: row.requires_serial,
        heat_number_required: row.heat_number_required,
        import_batch_id: batchId,
        source_row: sourceRow,
        created_at: now,
        updated_at: now,
      };
      data.materials.push(created);
      inserted += 1;
    }
  }

  data.materials.sort((a, b) => a.product_name.localeCompare(b.product_name));
  persist(data);
  return { inserted, updated };
}

export async function addGuestCheckIn(input: {
  material: Material;
  heatNumber: string;
  serialNumber: string;
  quantity: number;
  notes: string;
  files: Array<{ file: File; docType: DocumentRow["doc_type"] }>;
}) {
  const data = readGuestData();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const checkIn: CheckIn = {
    id,
    user_id: GUEST_USER_ID,
    material_id: input.material.id,
    product_name: input.material.product_name,
    product_code: input.material.product_code,
    heat_number: input.heatNumber.trim() || "N/A",
    serial_number: input.serialNumber.trim() || null,
    quantity: input.quantity,
    notes: input.notes.trim() || null,
    received_at: now,
    created_at: now,
  };
  data.checkIns.unshift(checkIn);

  for (const upload of input.files) {
    const docId = crypto.randomUUID();
    memoryUrls.set(docId, URL.createObjectURL(upload.file));
    let storagePath = `memory:${docId}`;
    if (upload.file.size <= MAX_PERSISTED_DATA_URL) {
      try {
        storagePath = await readAsDataUrl(upload.file);
      } catch {
        storagePath = `memory:${docId}`;
      }
    }
    const document: DocumentRow = {
      id: docId,
      user_id: GUEST_USER_ID,
      check_in_id: id,
      doc_type: upload.docType,
      file_name: upload.file.name,
      mime_type: upload.file.type || null,
      storage_path: storagePath,
      created_at: now,
    };
    data.documents.push(document);
  }

  persist(data);
  return { id };
}
