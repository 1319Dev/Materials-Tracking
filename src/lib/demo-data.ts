import type { CheckIn, DocumentRow, Material } from "@/lib/database.types";

export type GuestData = {
  version: 1;
  materials: Material[];
  checkIns: CheckIn[];
  documents: DocumentRow[];
};

const GUEST_USER_ID = "guest";
const DEMO_BATCH_ID = "demo-import";

function textFileDataUrl(text: string) {
  return `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`;
}

function atDaysAgo(days: number, hour: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 30, 0, 0);
  return date.toISOString();
}

function demoMaterial(
  row: Omit<
    Material,
    | "user_id"
    | "created_at"
    | "updated_at"
    | "import_batch_id"
    | "source_row"
    | "description"
    | "manufacturer"
    | "unit"
  > &
    Partial<Pick<Material, "description" | "manufacturer" | "unit">>,
  createdAt: string,
): Material {
  return {
    ...row,
    user_id: GUEST_USER_ID,
    created_at: createdAt,
    updated_at: createdAt,
    import_batch_id: DEMO_BATCH_ID,
    source_row: null,
    description: row.description ?? null,
    manufacturer: row.manufacturer ?? null,
    unit: row.unit ?? "ea",
  };
}

/** Sample catalog and receipts so guest mode is not an empty shell. */
export function createDemoGuestData(): GuestData {
  const seededAt = atDaysAgo(21, 8);

  const materials: Material[] = [
    demoMaterial(
      {
        id: "demo-mat-pipe-12",
        product_code: "PIPE-12-X42",
        product_name: "12in API 5L X42 Line Pipe",
        description: "Beveled ends",
        size: "12in",
        material_grade: "X42",
        manufacturer: "Example Mill",
        unit: "ft",
        requires_serial: false,
        heat_number_required: true,
      },
      seededAt,
    ),
    demoMaterial(
      {
        id: "demo-mat-ell-6",
        product_code: "ELL-6-90-STD",
        product_name: "6in 90 Elbow STD",
        description: "Long radius",
        size: "6in",
        material_grade: "A234 WPB",
        manufacturer: "Example Fitting Co",
        unit: "ea",
        requires_serial: false,
        heat_number_required: true,
      },
      seededAt,
    ),
    demoMaterial(
      {
        id: "demo-mat-valve-8",
        product_code: "VALVE-8-BALL",
        product_name: "8in Ball Valve Flanged",
        description: "Full port",
        size: "8in",
        material_grade: "A105",
        manufacturer: "Example Valve Inc",
        unit: "ea",
        requires_serial: true,
        heat_number_required: true,
      },
      seededAt,
    ),
    demoMaterial(
      {
        id: "demo-mat-flange-4",
        product_code: "FLANGE-4-WN",
        product_name: "4in Weld Neck Flange",
        description: "150 RF",
        size: "4in",
        material_grade: "A105",
        manufacturer: "Example Flange Co",
        unit: "ea",
        requires_serial: false,
        heat_number_required: true,
      },
      seededAt,
    ),
    demoMaterial(
      {
        id: "demo-mat-tee-6",
        product_code: "TEE-6-STD",
        product_name: "6in Straight Tee STD",
        description: "Butt weld",
        size: "6in",
        material_grade: "A234 WPB",
        manufacturer: "Example Fitting Co",
        unit: "ea",
        requires_serial: false,
        heat_number_required: true,
      },
      seededAt,
    ),
    demoMaterial(
      {
        id: "demo-mat-red-8x6",
        product_code: "RED-8X6",
        product_name: "8x6 Concentric Reducer",
        description: "Butt weld",
        size: "8x6",
        material_grade: "A234 WPB",
        manufacturer: "Example Fitting Co",
        unit: "ea",
        requires_serial: false,
        heat_number_required: true,
      },
      seededAt,
    ),
    demoMaterial(
      {
        id: "demo-mat-gasket-8",
        product_code: "GASKET-8-150",
        product_name: "8in Spiral Wound Gasket",
        description: "150 RF",
        size: "8in",
        material_grade: "316/Graphite",
        manufacturer: "Example Gasket Co",
        unit: "ea",
        requires_serial: false,
        heat_number_required: false,
      },
      seededAt,
    ),
    demoMaterial(
      {
        id: "demo-mat-bolt-8",
        product_code: "BOLT-8-B7",
        product_name: "8in B7 Stud Bolt Kit",
        description: "150 flange set",
        size: "8in",
        material_grade: "B7/2H",
        manufacturer: "Example Bolt Co",
        unit: "kit",
        requires_serial: false,
        heat_number_required: false,
      },
      seededAt,
    ),
    demoMaterial(
      {
        id: "demo-mat-cap-12",
        product_code: "CAP-12-STD",
        product_name: "12in Weld Cap",
        description: "STD weight",
        size: "12in",
        material_grade: "A234 WPB",
        manufacturer: "Example Fitting Co",
        unit: "ea",
        requires_serial: false,
        heat_number_required: true,
      },
      seededAt,
    ),
    demoMaterial(
      {
        id: "demo-mat-valve-2",
        product_code: "VALVE-2-GATE",
        product_name: "2in Gate Valve",
        description: "NPT",
        size: "2in",
        material_grade: "A105",
        manufacturer: "Example Valve Inc",
        unit: "ea",
        requires_serial: true,
        heat_number_required: true,
      },
      seededAt,
    ),
  ];

  const pipeAt = atDaysAgo(2, 14);
  const elbowAt = atDaysAgo(5, 10);
  const valveAt = atDaysAgo(1, 9);
  const flangeAt = atDaysAgo(9, 15);

  const checkIns: CheckIn[] = [
    {
      id: "demo-ci-valve-8",
      user_id: GUEST_USER_ID,
      material_id: "demo-mat-valve-8",
      product_name: "8in Ball Valve Flanged",
      product_code: "VALVE-8-BALL",
      heat_number: "H9002",
      serial_number: "BV-1044",
      quantity: 1,
      notes: "PO 4412 — laydown yard",
      received_at: valveAt,
      created_at: valveAt,
    },
    {
      id: "demo-ci-pipe-12",
      user_id: GUEST_USER_ID,
      material_id: "demo-mat-pipe-12",
      product_name: "12in API 5L X42 Line Pipe",
      product_code: "PIPE-12-X42",
      heat_number: "H4521",
      serial_number: null,
      quantity: 40,
      notes: "Truck 18, yard 2",
      received_at: pipeAt,
      created_at: pipeAt,
    },
    {
      id: "demo-ci-ell-6",
      user_id: GUEST_USER_ID,
      material_id: "demo-mat-ell-6",
      product_name: "6in 90 Elbow STD",
      product_code: "ELL-6-90-STD",
      heat_number: "H7781",
      serial_number: null,
      quantity: 12,
      notes: null,
      received_at: elbowAt,
      created_at: elbowAt,
    },
    {
      id: "demo-ci-flange-4",
      user_id: GUEST_USER_ID,
      material_id: "demo-mat-flange-4",
      product_name: "4in Weld Neck Flange",
      product_code: "FLANGE-4-WN",
      heat_number: "H3310",
      serial_number: null,
      quantity: 8,
      notes: null,
      received_at: flangeAt,
      created_at: flangeAt,
    },
  ];

  const documents: DocumentRow[] = [
    {
      id: "demo-doc-valve-pl",
      user_id: GUEST_USER_ID,
      check_in_id: "demo-ci-valve-8",
      doc_type: "packing_list",
      file_name: "packing-list-BV-1044.txt",
      mime_type: "text/plain",
      storage_path: textFileDataUrl(
        "DEMO PACKING LIST\n8in Ball Valve Flanged\nCode VALVE-8-BALL\nHeat H9002\nSerial BV-1044\nQty 1\n\nSample file stored on this device. Sign in to save real documents to the cloud.",
      ),
      created_at: valveAt,
    },
    {
      id: "demo-doc-valve-mtr",
      user_id: GUEST_USER_ID,
      check_in_id: "demo-ci-valve-8",
      doc_type: "mtr",
      file_name: "mtr-H9002.txt",
      mime_type: "text/plain",
      storage_path: textFileDataUrl(
        "DEMO MTR\nHeat H9002\nGrade A105\nProduct 8in Ball Valve Flanged\n\nSample material test report. Sign in to attach real PDFs.",
      ),
      created_at: valveAt,
    },
    {
      id: "demo-doc-pipe-pl",
      user_id: GUEST_USER_ID,
      check_in_id: "demo-ci-pipe-12",
      doc_type: "packing_list",
      file_name: "packing-list-H4521.txt",
      mime_type: "text/plain",
      storage_path: textFileDataUrl(
        "DEMO PACKING LIST\n12in API 5L X42 Line Pipe\nHeat H4521\nQty 40 ft\nYard 2 / Truck 18",
      ),
      created_at: pipeAt,
    },
  ];

  return { version: 1, materials, checkIns, documents };
}
