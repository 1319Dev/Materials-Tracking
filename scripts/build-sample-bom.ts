import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import XLSX from "xlsx";
import { autoDetectMapping, mapRows, parseSpreadsheetBuffer } from "../src/lib/spreadsheet.ts";
import { SAMPLE_BOM_LINES } from "../src/lib/sample-bom.ts";

const COL = {
  item: 0,
  qty: 2,
  size: 3,
  description: 5,
  wall: 19,
  grade: 21,
  manufacturer: 23,
  model: 30,
  heat: 33,
  ansi: 37,
} as const;

const SPANS: Array<[number, number]> = [
  [0, 1],
  [2, 2],
  [3, 4],
  [5, 18],
  [19, 20],
  [21, 22],
  [23, 29],
  [30, 32],
  [33, 36],
  [37, 39],
];

const lines = [
  ...SAMPLE_BOM_LINES.filter((line) => line.projectNumber === "24-118"),
  {
    item: "T-6-STD",
    orderedQty: 10,
    sizeInches: "6",
    description: "6 in straight tee, butt weld",
    wallSdr: "STD",
    steelGrade: "A234 WPB",
    manufacturer: "Hackney",
    modelNumber: "TEE-6-STD",
    heatLotSerial: "",
    ansiRating: "",
  },
];

const sheet: XLSX.WorkSheet = {};
const merges: XLSX.Range[] = [];

function put(row: number, col: number, value: string | number) {
  const address = XLSX.utils.encode_cell({ r: row, c: col });
  sheet[address] = typeof value === "number" ? { t: "n", v: value } : { t: "s", v: value };
}

put(0, 16, "BILL OF MATERIALS");
put(0, 26, "Construction Order No:");
put(0, 32, "CO-5521");
put(2, 0, "Page:");
put(2, 5, "of");
put(2, 27, "Project Number:");
put(2, 31, "24-118");
put(2, 34, "●");

const headers: Array<[number, string]> = [
  [COL.item, "Item"],
  [COL.qty, "QTY"],
  [COL.size, "Size   (Inches)"],
  [COL.description, "Description (Complete Information)"],
  [COL.wall, "Wall / SDR"],
  [COL.grade, "Steel Grade"],
  [COL.manufacturer, "Manufacturer"],
  [COL.model, "Model Number"],
  [COL.heat, "Serial / Lot / Heat #"],
  [COL.ansi, "ANSI / Pressure Rating"],
];

for (const [col, label] of headers) put(4, col, label);
for (const [start, end] of SPANS) {
  merges.push({ s: { r: 4, c: start }, e: { r: 5, c: end } });
}

lines.forEach((line, index) => {
  const row = 6 + index;
  put(row, COL.item, line.item);
  put(row, COL.qty, line.orderedQty);
  put(row, COL.size, line.sizeInches);
  put(row, COL.description, line.description);
  if (line.wallSdr) put(row, COL.wall, line.wallSdr);
  put(row, COL.grade, line.steelGrade);
  put(row, COL.manufacturer, line.manufacturer);
  if (line.modelNumber) put(row, COL.model, line.modelNumber);
  if (line.heatLotSerial) put(row, COL.heat, line.heatLotSerial);
  if (line.ansiRating) put(row, COL.ansi, line.ansiRating);
  for (const [start, end] of SPANS) {
    merges.push({ s: { r: row, c: start }, e: { r: row, c: end } });
  }
});

sheet["!merges"] = merges;
sheet["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 5 + lines.length, c: 39 } });

const outPath = resolve("public/samples/pipeline-bom.xlsx");
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
XLSX.writeFile(workbook, outPath);

function toArrayBuffer(filePath: string) {
  const file = readFileSync(filePath);
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
}

const parsed = parseSpreadsheetBuffer(toArrayBuffer(outPath), "pipeline-bom.xlsx");
const mapping = autoDetectMapping(parsed.headers);
const mapped = mapRows(parsed.rows, mapping, parsed.job);
const expected = [
  "product_code",
  "product_name",
  "ordered_qty",
  "size_inches",
  "wall_sdr",
  "steel_grade",
  "manufacturer",
  "model_number",
  "heat_lot_serial",
  "ansi_rating",
];
for (const field of expected) {
  if (!Object.values(mapping).includes(field as never)) {
    throw new Error(`Sample BOM did not map ${field}: ${JSON.stringify(mapping)}`);
  }
}
if (parsed.job.project_number !== "24-118" || parsed.job.construction_order !== "CO-5521") {
  throw new Error(`Job header missed: ${JSON.stringify(parsed.job)}`);
}
if (mapped.materials.length !== lines.length) {
  throw new Error(`Expected ${lines.length} lines, got ${mapped.materials.length}`);
}
const pipe = mapped.materials.find((row) => row.product_code === "P-12-X52");
if (!pipe || pipe.ordered_qty !== 240 || pipe.size_inches !== "12.75" || pipe.steel_grade !== "X52") {
  throw new Error(`Pipe row mapped wrong: ${JSON.stringify(pipe)}`);
}
const tee = mapped.materials.find((row) => row.product_code === "T-6-STD");
if (!tee || tee.project_number !== "24-118") {
  throw new Error(`Tee row missed the sheet job: ${JSON.stringify(tee)}`);
}

const garrettPath = resolve("/home/ubuntu/.cursor/projects/workspace/uploads/garrett-bill-of-materials_186c.xlsx");
const garrett = parseSpreadsheetBuffer(toArrayBuffer(garrettPath), "garrett-bill-of-materials.xlsx");
const garrettMap = autoDetectMapping(garrett.headers);
for (const field of expected) {
  if (!Object.values(garrettMap).includes(field as never)) {
    throw new Error(`Garrett template did not map ${field}: ${JSON.stringify(garrettMap)} headers ${garrett.headers.join(" | ")}`);
  }
}
if (garrett.headerRow !== 5) throw new Error(`Garrett header row ${garrett.headerRow}`);
const garrettRows = mapRows(garrett.rows, garrettMap, garrett.job);
if (garrettRows.materials.length !== 0) {
  throw new Error(`Blank template should import 0 lines, got ${garrettRows.materials.length}`);
}

console.log(`Wrote ${outPath}`);
console.log(`Sample lines ${mapped.materials.length}; Garrett header row ${garrett.headerRow}; Garrett CO ${garrett.job.construction_order ?? "(none)"}`);
