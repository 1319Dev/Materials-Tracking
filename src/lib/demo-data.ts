import type { CheckIn, DocumentRow, Material, MaterialIssue, PackingListStatus } from "@/lib/database.types";
import { derivePackingStatus, splitHeatLotSerial } from "@/lib/quantities";
import { SAMPLE_BOM_LINES, type SampleBomLine } from "@/lib/sample-bom";

export type GuestData = {
  version: 2;
  materials: Material[];
  checkIns: CheckIn[];
  documents: DocumentRow[];
  issues: MaterialIssue[];
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

function materialFromLine(line: SampleBomLine, createdAt: string, status: PackingListStatus): Material {
  return {
    id: line.id,
    user_id: GUEST_USER_ID,
    product_code: line.item,
    product_name: line.description,
    description: line.description,
    size: line.sizeInches,
    size_inches: line.sizeInches,
    material_grade: line.steelGrade || null,
    steel_grade: line.steelGrade || null,
    wall_sdr: line.wallSdr || null,
    manufacturer: line.manufacturer || null,
    model_number: line.modelNumber || null,
    ansi_rating: line.ansiRating || null,
    heat_lot_serial: line.heatLotSerial || null,
    project_number: line.projectNumber,
    construction_order: line.constructionOrder,
    ordered_qty: line.orderedQty,
    issued_qty: 0,
    unit: line.unit,
    requires_serial: line.requiresSerial,
    heat_number_required: true,
    packing_list_status: status,
    import_batch_id: DEMO_BATCH_ID,
    source_row: null,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

type ReceiptSeed = {
  id: string;
  materialId: string;
  quantity: number;
  daysAgo: number;
  hour: number;
  notes: string | null;
  packingList?: string;
  mtr?: string;
  heat?: string;
  lot?: string;
  serial?: string;
  shipment?: string;
};

type IssueSeed = {
  id: string;
  materialId: string;
  quantity: number;
  daysAgo: number;
  hour: number;
  notes: string;
};

/** Sample job so guest mode opens on a real coordinator sheet, not an empty catalog. */
export function createDemoGuestData(): GuestData {
  const seededAt = atDaysAgo(21, 8);
  const identity = new Map(SAMPLE_BOM_LINES.map((line) => [line.id, splitHeatLotSerial(line.heatLotSerial)]));

  const receipts: ReceiptSeed[] = [
    {
      id: "demo-ci-pipe-12",
      materialId: "demo-mat-pipe-12",
      quantity: 200,
      daysAgo: 2,
      hour: 14,
      notes: "Truck 18, yard 2. Short 40 ft against the BOM.",
      heat: "H-45219",
      packingList: "DEMO PACKING LIST\n12 in API 5L PSL2 X52 line pipe\nItem P-12-X52\nHeat H-45219\nQty received 200 ft of 240 ft ordered\nProject 24-118 / CO-5521\nYard 2 / Truck 18",
      mtr: "DEMO MTR\nHeat H-45219\nGrade X52\n12.75 in x 0.375 in API 5L PSL2\nAmerican Steel Pipe\n\nSample material test report stored on this device.",
    },
    {
      id: "demo-ci-ell-6",
      materialId: "demo-mat-ell-6",
      quantity: 18,
      daysAgo: 5,
      hour: 10,
      notes: "Full receipt against the packing list.",
      heat: "H-77810",
      packingList: "DEMO PACKING LIST\n6 in 90 LR elbow\nItem E-6-90\nHeat H-77810\nQty 18",
      mtr: "DEMO MTR\nHeat H-77810\nA234 WPB\n6 in LR 90 elbow STD\nHackney Ladish",
    },
    {
      id: "demo-ci-valve-8",
      materialId: "demo-mat-valve-8",
      quantity: 2,
      daysAgo: 1,
      hour: 9,
      notes: "Two of four valves on the BOM. Mill cert was not in the crate.",
      heat: "H-90021",
      serial: "BV-4418",
      shipment: "MRC-1844",
      packingList: "DEMO PACKING LIST\n8 in Class 600 ball valve\nItem V-8-600\nHeat H-90021\nSerial BV-4418\nShipment MRC-1844\nQty received 2 of 4\nMTR not included",
    },
    {
      id: "demo-ci-flange-4",
      materialId: "demo-mat-flange-4",
      quantity: 16,
      daysAgo: 9,
      hour: 15,
      notes: null,
      heat: "H-33102",
      packingList: "DEMO PACKING LIST\n4 in WN flange 600 RF\nItem F-4-WN\nHeat H-33102\nQty 16",
      mtr: "DEMO MTR\nHeat H-33102\nA105\n4 in weld neck 600 RF\nBoltex",
    },
    {
      id: "demo-ci-valve-2",
      materialId: "demo-mat-valve-2",
      quantity: 2,
      daysAgo: 4,
      hour: 11,
      notes: null,
      heat: "H-22091",
      serial: "GV-2201",
      packingList: "DEMO PACKING LIST\n2 in gate valve 800\nItem V-2-800\nHeat H-22091\nSerial GV-2201\nQty 2",
      mtr: "DEMO MTR\nHeat H-22091\nA105\n2 in gate valve NPT\nBonney Forge\nSerial GV-2201",
    },
    {
      id: "demo-ci-pipe-16",
      materialId: "demo-mat-pipe-16",
      quantity: 120,
      daysAgo: 6,
      hour: 13,
      notes: "Second job, full receipt.",
      heat: "H-61002",
      packingList: "DEMO PACKING LIST\n16 in API 5L X65\nItem P-16-X65\nHeat H-61002\nQty 120 ft\nProject 24-204 / CO-5602",
      mtr: "DEMO MTR\nHeat H-61002\nX65\n16 in x 0.500 in\nStupp",
    },
  ];

  const issueSeeds: IssueSeed[] = [
    {
      id: "demo-issue-pipe-12",
      materialId: "demo-mat-pipe-12",
      quantity: 80,
      daysAgo: 1,
      hour: 7,
      notes: "Spread A, station 112+00",
    },
    {
      id: "demo-issue-ell-6",
      materialId: "demo-mat-ell-6",
      quantity: 6,
      daysAgo: 1,
      hour: 8,
      notes: "MLV-12 welds",
    },
    {
      id: "demo-issue-flange-4",
      materialId: "demo-mat-flange-4",
      quantity: 4,
      daysAgo: 3,
      hour: 16,
      notes: "Launcher flange set",
    },
    {
      id: "demo-issue-valve-2",
      materialId: "demo-mat-valve-2",
      quantity: 1,
      daysAgo: 2,
      hour: 15,
      notes: "Blowdown assembly",
    },
  ];

  const receivedByMaterial = new Map<string, number>();
  for (const receipt of receipts) {
    receivedByMaterial.set(receipt.materialId, (receivedByMaterial.get(receipt.materialId) ?? 0) + receipt.quantity);
  }
  const issuedByMaterial = new Map<string, number>();
  for (const issue of issueSeeds) {
    issuedByMaterial.set(issue.materialId, (issuedByMaterial.get(issue.materialId) ?? 0) + issue.quantity);
  }

  const materials = SAMPLE_BOM_LINES.map((line) => {
    const received = receivedByMaterial.get(line.id) ?? 0;
    const markedMissing = line.id === "demo-mat-red-12x8";
    const material = materialFromLine(
      line,
      seededAt,
      derivePackingStatus(line.orderedQty, received, markedMissing),
    );
    material.issued_qty = issuedByMaterial.get(line.id) ?? 0;
    return material;
  });

  const checkIns: CheckIn[] = receipts.map((receipt) => {
    const line = SAMPLE_BOM_LINES.find((row) => row.id === receipt.materialId);
    const fallback = identity.get(receipt.materialId);
    const receivedAt = atDaysAgo(receipt.daysAgo, receipt.hour);
    return {
      id: receipt.id,
      user_id: GUEST_USER_ID,
      material_id: receipt.materialId,
      product_name: line?.description ?? "Material",
      product_code: line?.item ?? null,
      heat_number: receipt.heat || fallback?.heat || "N/A",
      lot_number: receipt.lot || fallback?.lot || null,
      serial_number: receipt.serial || fallback?.serial || null,
      shipment_number: receipt.shipment || null,
      quantity: receipt.quantity,
      notes: receipt.notes,
      received_at: receivedAt,
      created_at: receivedAt,
    };
  });

  const documents: DocumentRow[] = [];
  for (const receipt of receipts) {
    const receivedAt = checkIns.find((row) => row.id === receipt.id)?.received_at ?? seededAt;
    if (receipt.packingList) {
      documents.push({
        id: `${receipt.id}-pl`,
        user_id: GUEST_USER_ID,
        check_in_id: receipt.id,
        doc_type: "packing_list",
        file_name: `packing-list-${receipt.id}.txt`,
        mime_type: "text/plain",
        storage_path: textFileDataUrl(receipt.packingList),
        created_at: receivedAt,
      });
    }
    if (receipt.mtr) {
      documents.push({
        id: `${receipt.id}-mtr`,
        user_id: GUEST_USER_ID,
        check_in_id: receipt.id,
        doc_type: "mtr",
        file_name: `mtr-${receipt.id}.txt`,
        mime_type: "text/plain",
        storage_path: textFileDataUrl(receipt.mtr),
        created_at: receivedAt,
      });
    }
  }

  const issues: MaterialIssue[] = issueSeeds.map((issue) => {
    const line = SAMPLE_BOM_LINES.find((row) => row.id === issue.materialId);
    const issuedAt = atDaysAgo(issue.daysAgo, issue.hour);
    return {
      id: issue.id,
      user_id: GUEST_USER_ID,
      material_id: issue.materialId,
      quantity: issue.quantity,
      notes: issue.notes,
      project_number: line?.projectNumber ?? null,
      construction_order: line?.constructionOrder ?? null,
      issued_at: issuedAt,
      created_at: issuedAt,
    };
  });

  return { version: 2, materials, checkIns, documents, issues };
}
