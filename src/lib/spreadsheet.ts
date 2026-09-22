import Papa from "papaparse";
import * as XLSX from "xlsx";

export type CatalogField =
  | "product_code"
  | "product_name"
  | "description"
  | "size"
  | "material_grade"
  | "manufacturer"
  | "unit"
  | "requires_serial"
  | "heat_number_required"
  | "skip";

export const CATALOG_FIELD_LABELS: Record<CatalogField, string> = {
  product_code: "Product code",
  product_name: "Product name",
  description: "Description",
  size: "Size",
  material_grade: "Grade",
  manufacturer: "Manufacturer",
  unit: "Unit",
  requires_serial: "Requires serial",
  heat_number_required: "Heat # required",
  skip: "— skip —",
};

const ALIASES: Record<Exclude<CatalogField, "skip">, string[]> = {
  product_code: [
    "product_code",
    "product code",
    "code",
    "sku",
    "item",
    "item code",
    "item_code",
    "part",
    "part number",
    "part_number",
    "part no",
    "partno",
  ],
  product_name: [
    "product_name",
    "product name",
    "product",
    "name",
    "description of material",
    "material",
    "item description",
    "item name",
  ],
  description: ["description", "desc", "notes", "details"],
  size: ["size", "nominal size", "diameter", "od", "nps"],
  material_grade: ["grade", "material grade", "spec", "specification", "alloy"],
  manufacturer: ["manufacturer", "mfr", "vendor", "supplier", "mill"],
  unit: ["unit", "uom", "units"],
  requires_serial: [
    "requires_serial",
    "requires serial",
    "serial required",
    "serialized",
    "serial",
  ],
  heat_number_required: [
    "heat_number_required",
    "heat required",
    "heat number required",
    "requires heat",
    "mtr required",
  ],
};

export type ParsedSheet = {
  headers: string[];
  rows: Record<string, string>[];
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, " ");
}

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
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

export function autoDetectMapping(headers: string[]): Record<string, CatalogField> {
  const mapping: Record<string, CatalogField> = {};
  const used = new Set<CatalogField>();

  for (const header of headers) {
    const normalized = normalizeHeader(header);
    let matched: CatalogField = "skip";

    for (const [field, aliases] of Object.entries(ALIASES) as [
      Exclude<CatalogField, "skip">,
      string[],
    ][]) {
      if (used.has(field)) continue;
      if (aliases.some((alias) => normalizeHeader(alias) === normalized)) {
        matched = field;
        used.add(field);
        break;
      }
    }

    mapping[header] = matched;
  }

  if (!used.has("product_name") && headers.length > 0) {
    const firstUnused = headers.find((h) => mapping[h] === "skip") ?? headers[0];
    mapping[firstUnused] = "product_name";
  }

  return mapping;
}

export async function parseSpreadsheetFile(file: File): Promise<ParsedSheet> {
  const name = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();

  if (name.endsWith(".csv") || file.type === "text/csv") {
    const text = new TextDecoder("utf-8").decode(buffer);
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });
    if (parsed.errors.length) {
      throw new Error(parsed.errors[0]?.message || "Failed to parse CSV");
    }
    const headers = parsed.meta.fields?.filter(Boolean) ?? [];
    const rows = (parsed.data ?? []).map((row) => {
      const out: Record<string, string> = {};
      for (const header of headers) {
        out[header] = cellToString(row[header]);
      }
      return out;
    });
    return { headers, rows };
  }

  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Spreadsheet has no sheets");
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  const headers =
    json.length > 0
      ? Object.keys(json[0]).map((h) => h.trim())
      : ((XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })[0] as
          | string[]
          | undefined) ?? []);

  const rows = json.map((row) => {
    const out: Record<string, string> = {};
    for (const header of headers) {
      out[header] = cellToString(row[header]);
    }
    return out;
  });

  return { headers, rows };
}

export type MappedMaterialRow = {
  product_code: string | null;
  product_name: string;
  description: string | null;
  size: string | null;
  material_grade: string | null;
  manufacturer: string | null;
  unit: string | null;
  requires_serial: boolean;
  heat_number_required: boolean;
  source_row: Record<string, string>;
};

export function mapRows(
  rows: Record<string, string>[],
  mapping: Record<string, CatalogField>,
): { materials: MappedMaterialRow[]; skipped: number } {
  const materials: MappedMaterialRow[] = [];
  let skipped = 0;

  for (const row of rows) {
    const get = (field: CatalogField) => {
      const header = Object.entries(mapping).find(([, v]) => v === field)?.[0];
      return header ? row[header]?.trim() || "" : "";
    };

    const product_name = get("product_name");
    if (!product_name) {
      skipped += 1;
      continue;
    }

    materials.push({
      product_code: get("product_code") || null,
      product_name,
      description: get("description") || null,
      size: get("size") || null,
      material_grade: get("material_grade") || null,
      manufacturer: get("manufacturer") || null,
      unit: get("unit") || "ea",
      requires_serial: parseBoolean(get("requires_serial"), false),
      heat_number_required: parseBoolean(get("heat_number_required"), true),
      source_row: row,
    });
  }

  return { materials, skipped };
}
