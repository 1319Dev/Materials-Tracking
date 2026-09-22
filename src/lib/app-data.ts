import type { CheckIn, DocumentRow, Json, Material } from "@/lib/database.types";
import {
  addGuestCheckIn,
  importGuestCatalog,
  readGuestData,
} from "@/lib/guest-store";
import type { MappedMaterialRow } from "@/lib/spreadsheet";
import { supabase } from "@/lib/supabase";

export type RecentCheckIn = {
  id: string;
  product_name: string;
  heat_number: string;
  serial_number: string | null;
  quantity: number;
  received_at: string;
};

export type InventoryListRow = {
  id: string;
  product_name: string;
  product_code: string | null;
  heat_number: string;
  serial_number: string | null;
  quantity: number;
  received_at: string;
  documents: { count: number }[] | null;
};

function documentCount(documents: DocumentRow[], checkInId: string) {
  return documents.filter((doc) => doc.check_in_id === checkInId).length;
}

function matchesQuery(row: CheckIn, query: string) {
  const hay = [row.product_name, row.product_code, row.heat_number, row.serial_number]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(query.toLowerCase());
}

export async function loadDashboard(local: boolean): Promise<{
  materialCount: number;
  checkInCount: number;
  recent: RecentCheckIn[];
  error: string | null;
}> {
  if (local) {
    const data = readGuestData();
    const recent = [...data.checkIns]
      .sort((a, b) => b.received_at.localeCompare(a.received_at))
      .slice(0, 8)
      .map((row) => ({
        id: row.id,
        product_name: row.product_name,
        heat_number: row.heat_number,
        serial_number: row.serial_number,
        quantity: row.quantity,
        received_at: row.received_at,
      }));
    return {
      materialCount: data.materials.length,
      checkInCount: data.checkIns.length,
      recent,
      error: null,
    };
  }

  const [{ count: materials, error: materialsError }, { count: checkIns, error: checkInsError }, recentResult] =
    await Promise.all([
      supabase.from("materials").select("*", { count: "exact", head: true }),
      supabase.from("check_ins").select("*", { count: "exact", head: true }),
      supabase
        .from("check_ins")
        .select("id, product_name, heat_number, serial_number, quantity, received_at")
        .order("received_at", { ascending: false })
        .limit(8),
    ]);

  return {
    materialCount: materials ?? 0,
    checkInCount: checkIns ?? 0,
    recent: recentResult.data ?? [],
    error: materialsError?.message || checkInsError?.message || recentResult.error?.message || null,
  };
}

export async function loadMaterials(local: boolean): Promise<{ materials: Material[]; error: string | null }> {
  if (local) {
    const materials = [...readGuestData().materials].sort((a, b) =>
      a.product_name.localeCompare(b.product_name),
    );
    return { materials, error: null };
  }

  const { data, error } = await supabase.from("materials").select("*").order("product_name").limit(2000);
  return { materials: data ?? [], error: error?.message ?? null };
}

export async function loadInventory(
  local: boolean,
  query: string,
): Promise<{ rows: InventoryListRow[]; error: string | null }> {
  if (local) {
    const data = readGuestData();
    const rows = [...data.checkIns]
      .filter((row) => (query ? matchesQuery(row, query) : true))
      .sort((a, b) => b.received_at.localeCompare(a.received_at))
      .slice(0, 100)
      .map((row) => ({
        id: row.id,
        product_name: row.product_name,
        product_code: row.product_code,
        heat_number: row.heat_number,
        serial_number: row.serial_number,
        quantity: row.quantity,
        received_at: row.received_at,
        documents: [{ count: documentCount(data.documents, row.id) }],
      }));
    return { rows, error: null };
  }

  let request = supabase
    .from("check_ins")
    .select("id, product_name, product_code, heat_number, serial_number, quantity, received_at, documents(count)")
    .order("received_at", { ascending: false })
    .limit(100);

  if (query) {
    const pattern = `%${query.replaceAll(",", " ")}%`;
    request = request.or(
      `product_name.ilike.${pattern},product_code.ilike.${pattern},heat_number.ilike.${pattern},serial_number.ilike.${pattern}`,
    );
  }

  const { data, error } = await request;
  return { rows: (data as InventoryListRow[] | null) ?? [], error: error?.message ?? null };
}

export async function loadCheckInDetail(
  local: boolean,
  id: string,
): Promise<{
  checkIn: CheckIn | null;
  material: Material | null;
  documents: DocumentRow[];
  error: string | null;
}> {
  if (local) {
    const data = readGuestData();
    const checkIn = data.checkIns.find((row) => row.id === id) ?? null;
    if (!checkIn) return { checkIn: null, material: null, documents: [], error: null };
    const material = checkIn.material_id
      ? (data.materials.find((row) => row.id === checkIn.material_id) ?? null)
      : null;
    const documents = data.documents
      .filter((doc) => doc.check_in_id === id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    return { checkIn, material, documents, error: null };
  }

  const { data, error } = await supabase.from("check_ins").select("*").eq("id", id).maybeSingle();
  if (error) return { checkIn: null, material: null, documents: [], error: error.message };
  if (!data) return { checkIn: null, material: null, documents: [], error: null };

  const [{ data: docs, error: docsError }, materialResult] = await Promise.all([
    supabase.from("documents").select("*").eq("check_in_id", id).order("created_at", { ascending: true }),
    data.material_id
      ? supabase.from("materials").select("*").eq("id", data.material_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  return {
    checkIn: data,
    material: materialResult.data,
    documents: docs ?? [],
    error: docsError?.message || materialResult.error?.message || null,
  };
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

export async function saveCheckIn(
  local: boolean,
  input: {
    material: Material;
    heatNumber: string;
    serialNumber: string;
    quantity: number;
    notes: string;
    files: Array<{ file: File; docType: "packing_list" | "mtr" }>;
  },
): Promise<{ id: string } | { error: string }> {
  if (local) {
    const saved = await addGuestCheckIn(input);
    return saved;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: checkIn, error: checkInError } = await supabase
    .from("check_ins")
    .insert({
      user_id: user.id,
      material_id: input.material.id,
      product_name: input.material.product_name,
      product_code: input.material.product_code,
      heat_number: input.heatNumber.trim() || "N/A",
      serial_number: input.serialNumber.trim() || null,
      quantity: input.quantity,
      notes: input.notes.trim() || null,
    })
    .select("id")
    .single();

  if (checkInError || !checkIn) return { error: checkInError?.message || "Failed to save check-in" };

  for (const upload of input.files) {
    const storagePath = `${user.id}/${checkIn.id}/${upload.docType}-${Date.now()}-${sanitizeFileName(upload.file.name)}`;
    const { error: storageError } = await supabase.storage.from("material-documents").upload(storagePath, upload.file, {
      contentType: upload.file.type || undefined,
      upsert: false,
    });
    if (storageError) return { error: storageError.message };

    const { error: docError } = await supabase.from("documents").insert({
      user_id: user.id,
      check_in_id: checkIn.id,
      doc_type: upload.docType,
      storage_path: storagePath,
      file_name: upload.file.name,
      mime_type: upload.file.type || null,
    });
    if (docError) return { error: docError.message };
  }

  return { id: checkIn.id };
}

export async function importCatalog(
  local: boolean,
  fileName: string,
  mapped: MappedMaterialRow[],
): Promise<{ inserted: number; updated: number } | { error: string }> {
  if (local) return importGuestCatalog(mapped);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .insert({
      user_id: user.id,
      file_name: fileName,
      row_count: mapped.length,
    })
    .select("id")
    .single();

  if (batchError || !batch) return { error: batchError?.message || "Failed to create import batch" };

  const { data: existing, error: existingError } = await supabase
    .from("materials")
    .select("id, product_code, product_name");

  if (existingError) return { error: existingError.message };

  const byCode = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const row of existing ?? []) {
    if (row.product_code) byCode.set(row.product_code.toLowerCase(), row.id);
    byName.set(row.product_name.toLowerCase(), row.id);
  }

  let inserted = 0;
  let updated = 0;
  const chunkSize = 50;

  type MaterialWrite = {
    product_code: string | null;
    product_name: string;
    description: string | null;
    size: string | null;
    material_grade: string | null;
    manufacturer: string | null;
    unit: string | null;
    requires_serial: boolean;
    heat_number_required: boolean;
    import_batch_id: string;
    source_row: Json;
    updated_at: string;
  };

  for (let i = 0; i < mapped.length; i += chunkSize) {
    const chunk = mapped.slice(i, i + chunkSize);
    const toInsert: Array<MaterialWrite & { user_id: string }> = [];
    const updates: Array<{ id: string; payload: MaterialWrite }> = [];

    for (const row of chunk) {
      const payload: MaterialWrite = {
        product_code: row.product_code,
        product_name: row.product_name,
        description: row.description,
        size: row.size,
        material_grade: row.material_grade,
        manufacturer: row.manufacturer,
        unit: row.unit,
        requires_serial: row.requires_serial,
        heat_number_required: row.heat_number_required,
        import_batch_id: batch.id,
        source_row: row.source_row as Json,
        updated_at: new Date().toISOString(),
      };

      const existingId =
        (row.product_code && byCode.get(row.product_code.toLowerCase())) ||
        byName.get(row.product_name.toLowerCase());

      if (existingId) updates.push({ id: existingId, payload });
      else toInsert.push({ ...payload, user_id: user.id });
    }

    if (toInsert.length) {
      const { error: insertError } = await supabase.from("materials").insert(toInsert);
      if (insertError) return { error: insertError.message };
      inserted += toInsert.length;
    }

    for (const update of updates) {
      const { error: updateError } = await supabase.from("materials").update(update.payload).eq("id", update.id);
      if (updateError) return { error: updateError.message };
      updated += 1;
    }
  }

  return { inserted, updated };
}
