import type { CheckIn, DocumentRow, Json, Material, MaterialIssue } from "@/lib/database.types";
import {
  addGuestCheckIn,
  confirmGuestReceipt,
  createGuestMaterial,
  importGuestCatalog,
  issueGuestMaterial,
  readGuestData,
  type ConfirmLineInput,
  type GuestMaterialDraft,
} from "@/lib/guest-store";
import { buildOnHandRows, derivePackingStatus, rollupQuantities, type OnHandRow } from "@/lib/quantities";
import type { MappedMaterialRow } from "@/lib/spreadsheet";
import { supabase } from "@/lib/supabase";

export type RecentCheckIn = {
  id: string;
  product_name: string;
  heat_number: string;
  serial_number: string | null;
  lot_number: string | null;
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
  const hay = [row.product_name, row.product_code, row.heat_number, row.lot_number, row.serial_number]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(query.toLowerCase());
}

async function loadCloudBundle(): Promise<
  | { materials: Material[]; checkIns: CheckIn[]; documents: DocumentRow[]; issues: MaterialIssue[] }
  | { error: string }
> {
  const [materialsResult, checkInsResult, documentsResult, issuesResult] = await Promise.all([
    supabase.from("materials").select("*").order("product_name").limit(2000),
    supabase.from("check_ins").select("*").order("received_at", { ascending: false }).limit(5000),
    supabase.from("documents").select("*").limit(5000),
    supabase.from("material_issues").select("*").order("issued_at", { ascending: false }).limit(5000),
  ]);
  const error =
    materialsResult.error?.message ||
    checkInsResult.error?.message ||
    documentsResult.error?.message ||
    issuesResult.error?.message;
  if (error) return { error };
  return {
    materials: materialsResult.data ?? [],
    checkIns: checkInsResult.data ?? [],
    documents: documentsResult.data ?? [],
    issues: issuesResult.data ?? [],
  };
}

export async function loadOnHand(local: boolean): Promise<{ rows: OnHandRow[]; error: string | null }> {
  if (local) {
    const data = readGuestData();
    return {
      rows: buildOnHandRows(data.materials, data.checkIns, data.documents, data.issues),
      error: null,
    };
  }
  const bundle = await loadCloudBundle();
  if ("error" in bundle) return { rows: [], error: bundle.error };
  return {
    rows: buildOnHandRows(bundle.materials, bundle.checkIns, bundle.documents, bundle.issues),
    error: null,
  };
}

export async function loadDashboard(local: boolean): Promise<{
  materialCount: number;
  checkInCount: number;
  shortageCount: number;
  missingMtrCount: number;
  recent: RecentCheckIn[];
  rows: OnHandRow[];
  error: string | null;
}> {
  if (local) {
    const data = readGuestData();
    const rows = buildOnHandRows(data.materials, data.checkIns, data.documents, data.issues);
    const recent = [...data.checkIns]
      .sort((a, b) => b.received_at.localeCompare(a.received_at))
      .slice(0, 6)
      .map((row) => ({
        id: row.id,
        product_name: row.product_name,
        heat_number: row.heat_number,
        serial_number: row.serial_number,
        lot_number: row.lot_number,
        quantity: row.quantity,
        received_at: row.received_at,
      }));
    return {
      materialCount: data.materials.length,
      checkInCount: data.checkIns.length,
      shortageCount: rows.filter((row) => row.shortage > 0).length,
      missingMtrCount: rows.filter((row) => row.received > 0 && !row.hasMtr).length,
      recent,
      rows,
      error: null,
    };
  }

  const bundle = await loadCloudBundle();
  if ("error" in bundle) {
    return {
      materialCount: 0,
      checkInCount: 0,
      shortageCount: 0,
      missingMtrCount: 0,
      recent: [],
      rows: [],
      error: bundle.error,
    };
  }
  const rows = buildOnHandRows(bundle.materials, bundle.checkIns, bundle.documents, bundle.issues);
  return {
    materialCount: bundle.materials.length,
    checkInCount: bundle.checkIns.length,
    shortageCount: rows.filter((row) => row.shortage > 0).length,
    missingMtrCount: rows.filter((row) => row.received > 0 && !row.hasMtr).length,
    recent: bundle.checkIns.slice(0, 6).map((row) => ({
      id: row.id,
      product_name: row.product_name,
      heat_number: row.heat_number,
      serial_number: row.serial_number,
      lot_number: row.lot_number,
      quantity: Number(row.quantity),
      received_at: row.received_at,
    })),
    rows,
    error: null,
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

export async function loadMaterialDetail(
  local: boolean,
  id: string,
): Promise<{ row: OnHandRow | null; error: string | null }> {
  const { rows, error } = await loadOnHand(local);
  return { row: rows.find((entry) => entry.material.id === id) ?? null, error };
}

export async function loadCheckInDetail(
  local: boolean,
  id: string,
): Promise<{
  checkIn: CheckIn | null;
  material: Material | null;
  documents: DocumentRow[];
  row: OnHandRow | null;
  error: string | null;
}> {
  if (local) {
    const data = readGuestData();
    const checkIn = data.checkIns.find((row) => row.id === id) ?? null;
    if (!checkIn) return { checkIn: null, material: null, documents: [], row: null, error: null };
    const rows = buildOnHandRows(data.materials, data.checkIns, data.documents, data.issues);
    const row = checkIn.material_id ? (rows.find((entry) => entry.material.id === checkIn.material_id) ?? null) : null;
    const documents = data.documents
      .filter((doc) => doc.check_in_id === id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    return { checkIn, material: row?.material ?? null, documents, row, error: null };
  }

  const { data, error } = await supabase.from("check_ins").select("*").eq("id", id).maybeSingle();
  if (error) return { checkIn: null, material: null, documents: [], row: null, error: error.message };
  if (!data) return { checkIn: null, material: null, documents: [], row: null, error: null };

  const [{ data: docs, error: docsError }, hand] = await Promise.all([
    supabase.from("documents").select("*").eq("check_in_id", id).order("created_at", { ascending: true }),
    loadOnHand(false),
  ]);
  const row = data.material_id ? (hand.rows.find((entry) => entry.material.id === data.material_id) ?? null) : null;
  return {
    checkIn: data,
    material: row?.material ?? null,
    documents: docs ?? [],
    row,
    error: docsError?.message || hand.error,
  };
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

async function requireUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function materialWrite(row: MappedMaterialRow, batchId: string) {
  return {
    product_code: row.product_code,
    product_name: row.product_name,
    description: row.description,
    size: row.size_inches ?? row.size,
    size_inches: row.size_inches ?? row.size,
    material_grade: row.steel_grade ?? row.material_grade,
    steel_grade: row.steel_grade ?? row.material_grade,
    wall_sdr: row.wall_sdr,
    manufacturer: row.manufacturer,
    model_number: row.model_number,
    ansi_rating: row.ansi_rating,
    heat_lot_serial: row.heat_lot_serial,
    project_number: row.project_number,
    construction_order: row.construction_order,
    ordered_qty: row.ordered_qty,
    unit: row.unit,
    requires_serial: row.requires_serial,
    heat_number_required: row.heat_number_required,
    import_batch_id: batchId,
    source_row: row.source_row as Json,
    updated_at: new Date().toISOString(),
  };
}

export async function importCatalog(
  local: boolean,
  fileName: string,
  mapped: MappedMaterialRow[],
): Promise<{ inserted: number; updated: number } | { error: string }> {
  if (local) return importGuestCatalog(mapped);

  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };

  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .insert({ user_id: user.id, file_name: fileName, row_count: mapped.length })
    .select("id")
    .single();
  if (batchError || !batch) return { error: batchError?.message || "Failed to create import batch" };

  const { data: existing, error: existingError } = await supabase
    .from("materials")
    .select(
      "id, product_code, product_name, project_number, construction_order, ordered_qty, packing_list_status",
    );
  if (existingError) return { error: existingError.message };

  const { data: checkIns, error: checkInError } = await supabase.from("check_ins").select("material_id, quantity");
  if (checkInError) return { error: checkInError.message };

  let inserted = 0;
  let updated = 0;

  for (const row of mapped) {
    const payload = materialWrite(row, batch.id);
    const code = row.product_code?.toLowerCase() ?? "";
    const project = (row.project_number ?? "").toLowerCase();
    const order = (row.construction_order ?? "").toLowerCase();
    const match = (existing ?? []).find((material) => {
      if (code && material.product_code?.toLowerCase() === code) {
        const sameProject = !project || (material.project_number ?? "").toLowerCase() === project;
        const sameOrder = !order || (material.construction_order ?? "").toLowerCase() === order;
        return sameProject && sameOrder;
      }
      return (
        material.product_name.toLowerCase() === row.product_name.toLowerCase() &&
        (!project || (material.project_number ?? "").toLowerCase() === project)
      );
    });

    if (match) {
      const received = (checkIns ?? [])
        .filter((entry) => entry.material_id === match.id)
        .reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);
      const ordered = row.ordered_qty ?? Number(match.ordered_qty ?? 0);
      const update = {
        ...Object.fromEntries(Object.entries(payload).filter(([, value]) => value != null)),
        ordered_qty: ordered,
        packing_list_status: derivePackingStatus(
          ordered,
          received,
          match.packing_list_status === "missing" && received <= 0,
        ),
      };
      const { error: updateError } = await supabase.from("materials").update(update).eq("id", match.id);
      if (updateError) return { error: updateError.message };
      updated += 1;
    } else {
      const { error: insertError } = await supabase.from("materials").insert({
        ...payload,
        user_id: user.id,
        ordered_qty: row.ordered_qty ?? 0,
        unit: row.unit ?? "ea",
        requires_serial: row.requires_serial ?? false,
        heat_number_required: row.heat_number_required ?? true,
        issued_qty: 0,
        packing_list_status: "pending",
      });
      if (insertError) return { error: insertError.message };
      inserted += 1;
    }
  }

  return { inserted, updated };
}

export async function createMaterial(
  local: boolean,
  draft: GuestMaterialDraft,
): Promise<{ material: Material } | { error: string }> {
  if (local) return { material: createGuestMaterial(draft) };
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };
  const size = draft.size_inches?.trim() || null;
  const grade = draft.steel_grade?.trim() || null;
  const { data, error } = await supabase
    .from("materials")
    .insert({
      user_id: user.id,
      product_name: draft.product_name.trim(),
      product_code: draft.product_code?.trim() || null,
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
    })
    .select("*")
    .single();
  if (error || !data) return { error: error?.message || "Could not add that line" };
  return { material: data };
}

async function syncCloudStatus(materialId: string, markedMissing: boolean) {
  const [{ data: material }, { data: checkIns }, { data: issues }] = await Promise.all([
    supabase.from("materials").select("ordered_qty, packing_list_status").eq("id", materialId).maybeSingle(),
    supabase.from("check_ins").select("material_id, quantity").eq("material_id", materialId),
    supabase.from("material_issues").select("material_id, quantity").eq("material_id", materialId),
  ]);
  if (!material) return;
  const qty = rollupQuantities(
    { id: materialId, ordered_qty: Number(material.ordered_qty ?? 0), issued_qty: 0 },
    (checkIns ?? []).map((row) => ({ material_id: materialId, quantity: Number(row.quantity) })),
    (issues ?? []).map((row) => ({ material_id: materialId, quantity: Number(row.quantity) })),
  );
  await supabase
    .from("materials")
    .update({
      packing_list_status: derivePackingStatus(
        qty.ordered,
        qty.received,
        markedMissing || (material.packing_list_status === "missing" && qty.received <= 0),
      ),
      issued_qty: qty.issued,
      updated_at: new Date().toISOString(),
    })
    .eq("id", materialId);
}

async function uploadDocument(
  userId: string,
  checkInId: string,
  file: File,
  docType: DocumentRow["doc_type"],
  storagePath?: string,
) {
  const path =
    storagePath ??
    `${userId}/${checkInId}/${docType}-${Date.now()}-${sanitizeFileName(file.name)}`;
  if (!storagePath) {
    const { error: storageError } = await supabase.storage.from("material-documents").upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
    });
    if (storageError) return { error: storageError.message };
  }
  const { error: docError } = await supabase.from("documents").insert({
    user_id: userId,
    check_in_id: checkInId,
    doc_type: docType,
    storage_path: path,
    file_name: file.name,
    mime_type: file.type || null,
  });
  if (docError) return { error: docError.message };
  return { path };
}

export async function saveCheckIn(
  local: boolean,
  input: {
    material: Material;
    heatNumber: string;
    lotNumber: string;
    serialNumber: string;
    shipmentNumber: string;
    quantity: number;
    notes: string;
    files: Array<{ file: File; docType: "packing_list" | "mtr" }>;
  },
): Promise<{ id: string } | { error: string }> {
  if (local) return addGuestCheckIn(input);

  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };

  const { data: checkIn, error: checkInError } = await supabase
    .from("check_ins")
    .insert({
      user_id: user.id,
      material_id: input.material.id,
      product_name: input.material.product_name,
      product_code: input.material.product_code,
      heat_number: input.heatNumber.trim() || "N/A",
      lot_number: input.lotNumber.trim() || null,
      serial_number: input.serialNumber.trim() || null,
      shipment_number: input.shipmentNumber.trim() || null,
      quantity: input.quantity,
      notes: input.notes.trim() || null,
    })
    .select("id")
    .single();
  if (checkInError || !checkIn) return { error: checkInError?.message || "Failed to save check-in" };

  for (const upload of input.files) {
    const saved = await uploadDocument(user.id, checkIn.id, upload.file, upload.docType);
    if ("error" in saved && saved.error) return { error: saved.error };
  }

  const identity = [
    input.heatNumber.trim() ? `Heat ${input.heatNumber.trim()}` : "",
    input.lotNumber.trim() ? `Lot ${input.lotNumber.trim()}` : "",
    input.serialNumber.trim() ? `SN ${input.serialNumber.trim()}` : "",
  ].filter(Boolean);
  if (identity.length) {
    await supabase.from("materials").update({ heat_lot_serial: identity.join(" / ") }).eq("id", input.material.id);
  }
  await syncCloudStatus(input.material.id, false);
  return { id: checkIn.id };
}

export async function confirmPackingList(
  local: boolean,
  input: { lines: ConfirmLineInput[]; packingList: File | null; notes: string; shipmentNumber: string },
): Promise<{ created: number; missing: number; checkInIds: string[] } | { error: string }> {
  const actionable = input.lines.filter((line) => line.status === "missing" || line.quantity > 0);
  if (!actionable.length) return { error: "Mark at least one line full, partial, or missing." };
  const incomplete = actionable.find((line) => line.status === "partial" && line.quantity <= 0);
  if (incomplete) return { error: "Enter the quantity received for each partial line." };

  if (local) return confirmGuestReceipt({ ...input, lines: actionable });

  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };

  const { data: materials, error: materialsError } = await supabase.from("materials").select("*");
  if (materialsError) return { error: materialsError.message };
  const byId = new Map((materials ?? []).map((material) => [material.id, material]));

  let packingPath: string | undefined;
  if (input.packingList) {
    packingPath = `${user.id}/receipts/${crypto.randomUUID()}/packing-${sanitizeFileName(input.packingList.name)}`;
    const { error: storageError } = await supabase.storage
      .from("material-documents")
      .upload(packingPath, input.packingList, {
        contentType: input.packingList.type || undefined,
        upsert: false,
      });
    if (storageError) return { error: storageError.message };
  }

  const checkInIds: string[] = [];
  let missing = 0;
  for (const line of actionable) {
    const material = byId.get(line.materialId);
    if (!material) continue;
    if (line.status === "missing") {
      await syncCloudStatus(material.id, true);
      missing += 1;
      continue;
    }
    const { data: checkIn, error: checkInError } = await supabase
      .from("check_ins")
      .insert({
        user_id: user.id,
        material_id: material.id,
        product_name: material.product_name,
        product_code: material.product_code,
        heat_number: line.heatNumber.trim() || "N/A",
        lot_number: line.lotNumber.trim() || null,
        serial_number: line.serialNumber.trim() || null,
        shipment_number: input.shipmentNumber.trim() || null,
        quantity: line.quantity,
        notes: input.notes.trim() || "Packing list confirmation",
      })
      .select("id")
      .single();
    if (checkInError || !checkIn) return { error: checkInError?.message || "Failed to save a receipt line" };
    checkInIds.push(checkIn.id);

    if (input.packingList && packingPath) {
      const saved = await uploadDocument(user.id, checkIn.id, input.packingList, "packing_list", packingPath);
      if ("error" in saved && saved.error) return { error: saved.error };
    }
    if (line.mtrFile) {
      const saved = await uploadDocument(user.id, checkIn.id, line.mtrFile, "mtr");
      if ("error" in saved && saved.error) return { error: saved.error };
    }
    const identity = [
      line.heatNumber.trim() ? `Heat ${line.heatNumber.trim()}` : "",
      line.lotNumber.trim() ? `Lot ${line.lotNumber.trim()}` : "",
      line.serialNumber.trim() ? `SN ${line.serialNumber.trim()}` : "",
    ].filter(Boolean);
    if (identity.length) {
      await supabase.from("materials").update({ heat_lot_serial: identity.join(" / ") }).eq("id", material.id);
    }
    await syncCloudStatus(material.id, false);
  }

  return { created: checkInIds.length, missing, checkInIds };
}

export async function issueMaterial(
  local: boolean,
  input: { materialId: string; quantity: number; notes: string },
): Promise<{ id: string } | { error: string }> {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    return { error: "Enter a quantity to issue." };
  }
  if (local) return issueGuestMaterial(input);

  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };
  const hand = await loadOnHand(false);
  if (hand.error) return { error: hand.error };
  const row = hand.rows.find((entry) => entry.material.id === input.materialId);
  if (!row) return { error: "That material is not in your catalog." };
  if (input.quantity > row.onHand + 1e-9) {
    return { error: `Only ${row.onHand} on hand. Issue a smaller quantity.` };
  }

  const { data, error } = await supabase
    .from("material_issues")
    .insert({
      user_id: user.id,
      material_id: input.materialId,
      quantity: input.quantity,
      notes: input.notes.trim() || null,
      project_number: row.material.project_number,
      construction_order: row.material.construction_order,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message || "Could not record the issue" };
  await syncCloudStatus(input.materialId, false);
  return { id: data.id };
}
