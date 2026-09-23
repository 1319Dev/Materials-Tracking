export const MTR_FORM_TITLE = "MTR REQUEST FORM";

export const MTR_HEADER_FIELDS = [
  { key: "inspectorName", label: "Inspector Name" },
  { key: "vendor", label: "Vendor" },
  { key: "atmosProject", label: "Atmos Project #" },
  { key: "salesOrder", label: "Sales Order# / Customer PO #" },
  { key: "shipmentNumber", label: "Shipment # (MRC)" },
] as const;

export const MTR_LINE_COLUMNS = [
  { key: "materialDescription", label: "Material Description" },
  { key: "diameter", label: "Diameter" },
  { key: "wallThickness", label: "Wall Thickness" },
  { key: "grade", label: "Grade" },
  { key: "heatNumber", label: "Heat Number" },
  { key: "manufacturer", label: "Manufacturer" },
] as const;

export type MtrHeaderKey = (typeof MTR_HEADER_FIELDS)[number]["key"];
export type MtrLineKey = (typeof MTR_LINE_COLUMNS)[number]["key"];

export type MtrLine = Record<MtrLineKey, string>;

export type MtrRequestForm = Record<MtrHeaderKey, string> & {
  lines: MtrLine[];
};

/** Garrett's sheet leaves 34 blank line slots under the header row. */
export const MTR_SHEET_LINE_SLOTS = 34;
export const MTR_VISIBLE_LINES = 8;

export function emptyMtrLine(): MtrLine {
  return {
    materialDescription: "",
    diameter: "",
    wallThickness: "",
    grade: "",
    heatNumber: "",
    manufacturer: "",
  };
}

export function emptyMtrForm(): MtrRequestForm {
  return {
    inspectorName: "",
    vendor: "",
    atmosProject: "",
    salesOrder: "",
    shipmentNumber: "",
    lines: Array.from({ length: MTR_VISIBLE_LINES }, emptyMtrLine),
  };
}

/** Heat stays as written. Lot and serial are appended only when they exist. */
export function combineHeatNumber(heat: string, lot: string, serial: string) {
  const parts: string[] = [];
  const heatValue = heat.trim();
  const lotValue = lot.trim();
  const serialValue = serial.trim();
  if (heatValue && heatValue !== "N/A") parts.push(heatValue);
  if (lotValue) parts.push(parts.length ? `Lot ${lotValue}` : lotValue);
  if (serialValue) parts.push(parts.length ? `SN ${serialValue}` : serialValue);
  return parts.join(" / ");
}

export function withPrefill(header: Record<MtrHeaderKey, string>, line: MtrLine): MtrRequestForm {
  const lines = Array.from({ length: MTR_VISIBLE_LINES }, emptyMtrLine);
  lines[0] = line;
  return { ...header, lines };
}

export function mtrRequestText(form: MtrRequestForm) {
  const header = MTR_HEADER_FIELDS.map((field) => `${field.label}: ${form[field.key].trim()}`).join("\n");
  const filled = form.lines.filter((line) => MTR_LINE_COLUMNS.some((column) => line[column.key].trim()));
  const body = filled
    .map((line, index) => {
      const cells = MTR_LINE_COLUMNS.map((column) => `${column.label}: ${line[column.key].trim()}`).join("\n");
      return `Line ${index + 1}\n${cells}`;
    })
    .join("\n\n");
  return [MTR_FORM_TITLE, "", header, "", body].filter((part) => part !== undefined).join("\n");
}

function merge(row: number, startCol: number, endCol: number) {
  return { s: { r: row, c: startCol }, e: { r: row, c: endCol } };
}

export async function downloadMtrWorkbook(form: MtrRequestForm) {
  const XLSX = await import("xlsx");
  const slots = Math.max(form.lines.length, MTR_SHEET_LINE_SLOTS);
  const rows: string[][] = [];
  for (let index = 0; index < MTR_HEADER_FIELDS.length; index += 1) {
    const row = Array.from({ length: 17 }, () => "");
    if (index === 0) row[0] = MTR_FORM_TITLE;
    row[12] = MTR_HEADER_FIELDS[index].label;
    row[14] = form[MTR_HEADER_FIELDS[index].key];
    rows.push(row);
  }
  const columns = Array.from({ length: 17 }, () => "");
  columns[0] = "Material Description";
  columns[4] = "Diameter";
  columns[6] = "Wall Thickness";
  columns[8] = "Grade";
  columns[10] = "Heat Number";
  columns[12] = "Manufacturer";
  rows.push(columns);
  for (let index = 0; index < slots; index += 1) {
    const line = form.lines[index];
    const row = Array.from({ length: 17 }, () => "");
    if (line) {
      row[0] = line.materialDescription;
      row[4] = line.diameter;
      row[6] = line.wallThickness;
      row[8] = line.grade;
      row[10] = line.heatNumber;
      row[12] = line.manufacturer;
    }
    rows.push(row);
  }

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const merges = [{ s: { r: 0, c: 0 }, e: { r: 4, c: 11 } }];
  for (let row = 0; row < 5; row += 1) {
    merges.push(merge(row, 12, 13), merge(row, 14, 16));
  }
  for (let row = 5; row < 6 + slots; row += 1) {
    merges.push(merge(row, 0, 3), merge(row, 4, 5), merge(row, 6, 7), merge(row, 8, 9), merge(row, 10, 11), merge(row, 12, 16));
  }
  sheet["!merges"] = merges;
  sheet["!cols"] = [
    { wch: 18 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
    { wch: 10 },
    { wch: 8 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 8 },
    { wch: 12 },
    { wch: 12 },
    { wch: 18 },
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
  ];

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Sheet1");
  const slug = (form.atmosProject || form.lines[0]?.materialDescription || "mtr-request")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);
  XLSX.writeFile(book, `MTR-REQUEST-FORM-${slug || "blank"}.xlsx`);
}
