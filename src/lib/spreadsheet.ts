import Papa from "papaparse";
import * as XLSX from "xlsx";

export type CatalogField =
  | "product_code"
  | "product_name"
  | "description"
  | "ordered_qty"
  | "size_inches"
  | "wall_sdr"
  | "steel_grade"
  | "manufacturer"
  | "model_number"
  | "ansi_rating"
  | "heat_lot_serial"
  | "project_number"
  | "construction_order"
  | "unit"
  | "requires_serial"
  | "heat_number_required"
  | "skip";

export const CATALOG_FIELD_LABELS: Record<CatalogField, string> = {
  product_code: "Item",
  product_name: "Description",
  description: "Notes",
  ordered_qty: "QTY ordered",
  size_inches: "Size (inches)",
  wall_sdr: "Wall / SDR",
  steel_grade: "Steel grade",
  manufacturer: "Manufacturer",
  model_number: "Model number",
  ansi_rating: "ANSI / pressure rating",
  heat_lot_serial: "Serial / lot / heat",
  project_number: "Project number",
  construction_order: "Construction order",
  unit: "Unit",
  requires_serial: "Requires serial",
  heat_number_required: "Heat # required",
  skip: "— skip —",
};

const FIELD_ALIASES: Array<{ field: Exclude<CatalogField, "skip">; aliases: string[] }> = [
  {
    field: "product_code",
    aliases: ["product code", "item code", "item number", "item no", "part number", "part no", "sku", "code", "item"],
  },
  {
    field: "product_name",
    aliases: [
      "description complete information",
      "description of material",
      "item description",
      "material description",
      "product name",
      "product",
      "name",
      "material",
    ],
  },
  { field: "description", aliases: ["description", "desc", "notes", "details"] },
  {
    field: "ordered_qty",
    aliases: ["ordered qty", "order qty", "qty ordered", "quantity ordered", "qty", "quantity", "q ty"],
  },
  {
    field: "size_inches",
    aliases: ["size inches", "size in inches", "nominal size", "diameter", "size", "od", "nps"],
  },
  { field: "wall_sdr", aliases: ["wall sdr", "wall thickness", "sdr", "wall"] },
  {
    field: "steel_grade",
    aliases: ["steel grade", "material grade", "grade", "spec", "specification", "alloy"],
  },
  { field: "manufacturer", aliases: ["manufacturer", "mfr", "vendor", "supplier", "mill"] },
  { field: "model_number", aliases: ["model number", "model no", "model"] },
  {
    field: "ansi_rating",
    aliases: ["ansi pressure rating", "pressure rating", "ansi rating", "ansi", "pressure class"],
  },
  {
    field: "heat_lot_serial",
    aliases: [
      "serial lot heat",
      "heat lot serial",
      "serial number",
      "heat number",
      "lot number",
      "heat",
      "serial",
      "lot",
    ],
  },
  { field: "project_number", aliases: ["project number", "project no", "project num", "project"] },
  {
    field: "construction_order",
    aliases: ["construction order no", "construction order number", "construction order", "c o no"],
  },
  { field: "unit", aliases: ["unit", "uom", "units"] },
  {
    field: "requires_serial",
    aliases: ["requires serial", "serial required", "serialized"],
  },
  {
    field: "heat_number_required",
    aliases: ["heat number required", "heat required", "requires heat", "mtr required"],
  },
];

const HEADER_MARKERS = [
  "item",
  "qty",
  "quantity",
  "size",
  "description",
  "wall",
  "sdr",
  "steel grade",
  "grade",
  "manufacturer",
  "model",
  "serial",
  "heat",
  "ansi",
  "pressure",
  "product code",
  "product name",
  "project number",
  "construction order",
];

export type SheetJob = {
  project_number: string | null;
  construction_order: string | null;
};

export type ParsedSheet = {
  headers: string[];
  rows: Record<string, string>[];
  /** 1-based row number in the sheet. */
  headerRow: number;
  job: SheetJob;
};

export function normalizeHeader(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .toLowerCase()
    .replace(/[#/&]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function parseBoolean(value: string | undefined, defaultValue: boolean) {
  if (value == null || value === "") return defaultValue;
  const v = value.trim().toLowerCase();
  if (["1", "true", "yes", "y", "required", "x"].includes(v)) return true;
  if (["0", "false", "no", "n"].includes(v)) return false;
  return defaultValue;
}

function parseQty(value: string): number | null {
  if (!value.trim()) return null;
  const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

function isDecoration(value: string) {
  return /^[●•·\-–—*_.\s]+$/u.test(value.trim());
}

function scoreHeaderRow(row: string[]) {
  const seen = new Set<string>();
  for (const cell of row) {
    const normalized = normalizeHeader(cell);
    if (!normalized) continue;
    for (const marker of HEADER_MARKERS) {
      if (normalized === marker || normalized.includes(marker)) {
        seen.add(marker);
        break;
      }
    }
  }
  return seen.size;
}

function matchJobLabel(value: string): keyof SheetJob | null {
  const normalized = normalizeHeader(value);
  if (/construction\s+order/.test(normalized)) return "construction_order";
  if (/project\s+(number|no|num)\b/.test(normalized) || normalized === "project number") {
    return "project_number";
  }
  return null;
}

function valueToTheRight(row: string[], column: number) {
  for (let index = column + 1; index < row.length; index += 1) {
    const text = row[index]?.trim() ?? "";
    if (!text || isDecoration(text)) continue;
    if (matchJobLabel(text)) break;
    const normalized = normalizeHeader(text);
    if (normalized === "page" || normalized === "of") continue;
    return text;
  }
  return "";
}

function extractJob(matrix: string[][], headerIndex: number): SheetJob {
  const job: SheetJob = { project_number: null, construction_order: null };
  for (let rowIndex = 0; rowIndex < headerIndex; rowIndex += 1) {
    const row = matrix[rowIndex] ?? [];
    for (let column = 0; column < row.length; column += 1) {
      const raw = row[column]?.trim() ?? "";
      if (!raw) continue;
      const field = matchJobLabel(raw);
      if (!field || job[field]) continue;
      const inline = raw.includes(":") ? raw.split(":").slice(1).join(":").trim() : "";
      const value = inline && !isDecoration(inline) ? inline : valueToTheRight(row, column);
      if (value) job[field] = value;
    }
  }
  return job;
}

function isHeaderContinuation(row: string[]) {
  const cells = row.map((cell) => cell.trim()).filter(Boolean);
  if (!cells.length) return false;
  if (scoreHeaderRow(row) >= 3) return false;
  if (cells.some((cell) => cell.length > 48)) return false;
  if (cells.some((cell) => /^-?\d+(?:\.\d+)?$/.test(cell.replace(/,/g, "")))) return false;
  return cells.every((cell) => cell.length < 40);
}

function uniqueHeader(text: string, seen: Map<string, number>) {
  const count = seen.get(text) ?? 0;
  seen.set(text, count + 1);
  return count === 0 ? text : `${text} (${count + 1})`;
}

export function parseMatrix(matrix: string[][]): ParsedSheet {
  let headerIndex = 0;
  let bestScore = 0;
  matrix.forEach((row, index) => {
    const score = scoreHeaderRow(row);
    if (score > bestScore) {
      bestScore = score;
      headerIndex = index;
    }
  });
  if (bestScore < 3) headerIndex = 0;

  const headerCells = matrix[headerIndex]?.map((cell) => cell.trim().replace(/\s+/g, " ")) ?? [];
  let dataStart = headerIndex + 1;
  const continuation = matrix[dataStart];
  if (continuation && isHeaderContinuation(continuation)) {
    continuation.forEach((cell, index) => {
      const extra = cell.trim().replace(/\s+/g, " ");
      if (!extra) return;
      headerCells[index] = headerCells[index] ? `${headerCells[index]} ${extra}` : extra;
    });
    dataStart += 1;
  }

  const seen = new Map<string, number>();
  const headers: string[] = [];
  const columns: number[] = [];
  headerCells.forEach((cell, index) => {
    if (!cell) return;
    headers.push(uniqueHeader(cell, seen));
    columns.push(index);
  });

  const rows: Record<string, string>[] = [];
  for (let index = dataStart; index < matrix.length; index += 1) {
    const source = matrix[index] ?? [];
    const record: Record<string, string> = {};
    let any = false;
    headers.forEach((header, headerIndex) => {
      const value = (source[columns[headerIndex]] ?? "").trim();
      record[header] = value;
      if (value) any = true;
    });
    if (any) rows.push(record);
  }

  return {
    headers,
    rows,
    headerRow: headerIndex + 1,
    job: extractJob(matrix, headerIndex),
  };
}

function matrixFromSheet(sheet: XLSX.WorkSheet) {
  const table = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: true,
  });
  return table.map((row) => (Array.isArray(row) ? row : []).map((cell) => cellToString(cell)));
}

export function parseSpreadsheetBuffer(buffer: ArrayBuffer, fileName: string, mimeType = ""): ParsedSheet {
  const name = fileName.toLowerCase();
  if (name.endsWith(".csv") || mimeType === "text/csv") {
    const text = new TextDecoder("utf-8").decode(buffer);
    const parsed = Papa.parse<string[]>(text, { header: false, skipEmptyLines: false });
    if (parsed.errors.length) {
      throw new Error(parsed.errors[0]?.message || "Failed to parse CSV");
    }
    const matrix = (parsed.data ?? [])
      .filter((row) => Array.isArray(row))
      .map((row) => row.map((cell) => cellToString(cell)));
    return parseMatrix(matrix);
  }

  const workbook = XLSX.read(buffer, { type: "array" });
  let best: ParsedSheet | null = null;
  let bestScore = -1;
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const parsed = parseMatrix(matrixFromSheet(sheet));
    const score = scoreHeaderRow(parsed.headers);
    if (!best || score > bestScore) {
      best = parsed;
      bestScore = score;
    }
  }
  if (!best || !best.headers.length) throw new Error("Spreadsheet has no header row");
  return best;
}

export async function parseSpreadsheetFile(file: File): Promise<ParsedSheet> {
  const buffer = await file.arrayBuffer();
  return parseSpreadsheetBuffer(buffer, file.name, file.type);
}

function matchField(header: string): { field: Exclude<CatalogField, "skip">; score: number } | null {
  const normalized = normalizeHeader(header);
  if (!normalized) return null;
  let best: { field: Exclude<CatalogField, "skip">; score: number } | null = null;
  for (const entry of FIELD_ALIASES) {
    for (const alias of entry.aliases) {
      const normalizedAlias = normalizeHeader(alias);
      let score = 0;
      if (normalized === normalizedAlias) score = 100 + normalizedAlias.length;
      else if (normalized.includes(normalizedAlias) && normalizedAlias.length >= 3) {
        score = 50 + normalizedAlias.length;
      } else if (normalizedAlias.includes(normalized) && normalized.length >= 4) {
        score = 25 + normalized.length;
      }
      if (score > 0 && (!best || score > best.score)) {
        best = { field: entry.field, score };
      }
    }
  }
  return best;
}

export function autoDetectMapping(headers: string[]): Record<string, CatalogField> {
  const ranked = headers
    .map((header) => ({ header, match: matchField(header) }))
    .filter((entry): entry is { header: string; match: { field: Exclude<CatalogField, "skip">; score: number } } =>
      Boolean(entry.match),
    )
    .sort((a, b) => b.match.score - a.match.score);

  const mapping: Record<string, CatalogField> = {};
  const used = new Set<CatalogField>();
  for (const header of headers) mapping[header] = "skip";
  for (const entry of ranked) {
    if (used.has(entry.match.field)) continue;
    mapping[entry.header] = entry.match.field;
    used.add(entry.match.field);
  }

  if (!used.has("product_name") && !used.has("description") && headers.length > 0) {
    const fallback = headers.find((header) => mapping[header] === "skip");
    if (fallback) mapping[fallback] = "product_name";
  }

  return mapping;
}

export type MappedMaterialRow = {
  product_code: string | null;
  product_name: string;
  description: string | null;
  ordered_qty: number | null;
  size: string | null;
  size_inches: string | null;
  material_grade: string | null;
  steel_grade: string | null;
  wall_sdr: string | null;
  manufacturer: string | null;
  model_number: string | null;
  ansi_rating: string | null;
  heat_lot_serial: string | null;
  project_number: string | null;
  construction_order: string | null;
  unit: string | null;
  requires_serial: boolean | null;
  heat_number_required: boolean | null;
  source_row: Record<string, string>;
};

export function mapRows(
  rows: Record<string, string>[],
  mapping: Record<string, CatalogField>,
  job?: SheetJob,
): { materials: MappedMaterialRow[]; skipped: number } {
  const materials: MappedMaterialRow[] = [];
  let skipped = 0;

  for (const row of rows) {
    const get = (field: CatalogField) => {
      const header = Object.entries(mapping).find(([, value]) => value === field)?.[0];
      return header ? row[header]?.trim() || "" : "";
    };

    const named = get("product_name");
    const described = get("description");
    const product_name = named || described;
    if (!product_name) {
      skipped += 1;
      continue;
    }

    const size = get("size_inches") || null;
    const grade = get("steel_grade") || null;
    const ordered = get("ordered_qty");
    const mapped = (field: CatalogField) => Object.values(mapping).includes(field);

    materials.push({
      product_code: get("product_code") || null,
      product_name,
      description: named && described ? described : described || named,
      ordered_qty: !mapped("ordered_qty") || ordered === "" ? null : parseQty(ordered),
      size,
      size_inches: size,
      material_grade: grade,
      steel_grade: grade,
      wall_sdr: get("wall_sdr") || null,
      manufacturer: get("manufacturer") || null,
      model_number: get("model_number") || null,
      ansi_rating: get("ansi_rating") || null,
      heat_lot_serial: get("heat_lot_serial") || null,
      project_number: get("project_number") || job?.project_number || null,
      construction_order: get("construction_order") || job?.construction_order || null,
      unit: get("unit") || null,
      requires_serial: mapped("requires_serial") ? parseBoolean(get("requires_serial"), false) : null,
      heat_number_required: mapped("heat_number_required")
        ? parseBoolean(get("heat_number_required"), true)
        : null,
      source_row: row,
    });
  }

  return { materials, skipped };
}
