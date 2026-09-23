/** Realistic pipeline BOM lines shaped like Garrett's bill of materials. */
export type SampleBomLine = {
  id: string;
  item: string;
  orderedQty: number;
  sizeInches: string;
  description: string;
  wallSdr: string;
  steelGrade: string;
  manufacturer: string;
  modelNumber: string;
  heatLotSerial: string;
  ansiRating: string;
  unit: string;
  requiresSerial: boolean;
  projectNumber: string;
  constructionOrder: string;
};

export const SAMPLE_BOM_LINES: SampleBomLine[] = [
  {
    id: "demo-mat-pipe-12",
    item: "P-12-X52",
    orderedQty: 240,
    sizeInches: "12.75",
    description: "12 in API 5L PSL2 X52 line pipe, beveled ends, 40 ft joints",
    wallSdr: "0.375",
    steelGrade: "X52",
    manufacturer: "American Steel Pipe",
    modelNumber: "",
    heatLotSerial: "H-45219",
    ansiRating: "",
    unit: "ft",
    requiresSerial: false,
    projectNumber: "24-118",
    constructionOrder: "CO-5521",
  },
  {
    id: "demo-mat-ell-6",
    item: "E-6-90",
    orderedQty: 18,
    sizeInches: "6",
    description: "6 in 90 degree long radius elbow, butt weld",
    wallSdr: "STD",
    steelGrade: "A234 WPB",
    manufacturer: "Hackney Ladish",
    modelNumber: "LR90-6-STD",
    heatLotSerial: "H-77810",
    ansiRating: "",
    unit: "ea",
    requiresSerial: false,
    projectNumber: "24-118",
    constructionOrder: "CO-5521",
  },
  {
    id: "demo-mat-valve-8",
    item: "V-8-600",
    orderedQty: 4,
    sizeInches: "8",
    description: "8 in Class 600 ball valve, RF flanged, full port",
    wallSdr: "",
    steelGrade: "A105 / WCB",
    manufacturer: "Cameron",
    modelNumber: "T31-8-600",
    heatLotSerial: "Heat H-90021 / SN BV-4418",
    ansiRating: "ANSI 600",
    unit: "ea",
    requiresSerial: true,
    projectNumber: "24-118",
    constructionOrder: "CO-5521",
  },
  {
    id: "demo-mat-flange-4",
    item: "F-4-WN",
    orderedQty: 16,
    sizeInches: "4",
    description: "4 in weld neck flange, 600 RF, bore to STD",
    wallSdr: "STD",
    steelGrade: "A105",
    manufacturer: "Boltex",
    modelNumber: "WN-4-600",
    heatLotSerial: "H-33102",
    ansiRating: "ANSI 600",
    unit: "ea",
    requiresSerial: false,
    projectNumber: "24-118",
    constructionOrder: "CO-5521",
  },
  {
    id: "demo-mat-red-12x8",
    item: "R-12X8",
    orderedQty: 8,
    sizeInches: "12 x 8",
    description: "12 in x 8 in concentric reducer, butt weld",
    wallSdr: "0.375 x 0.322",
    steelGrade: "A234 WPB",
    manufacturer: "Hackney",
    modelNumber: "CR-12X8",
    heatLotSerial: "",
    ansiRating: "",
    unit: "ea",
    requiresSerial: false,
    projectNumber: "24-118",
    constructionOrder: "CO-5521",
  },
  {
    id: "demo-mat-valve-2",
    item: "V-2-800",
    orderedQty: 2,
    sizeInches: "2",
    description: "2 in gate valve, threaded NPT, 800 class",
    wallSdr: "",
    steelGrade: "A105",
    manufacturer: "Bonney Forge",
    modelNumber: "GV-2-800",
    heatLotSerial: "Heat H-22091 / SN GV-2201",
    ansiRating: "ANSI 800",
    unit: "ea",
    requiresSerial: true,
    projectNumber: "24-118",
    constructionOrder: "CO-5521",
  },
  {
    id: "demo-mat-pipe-16",
    item: "P-16-X65",
    orderedQty: 120,
    sizeInches: "16",
    description: "16 in API 5L PSL2 X65 line pipe, beveled ends",
    wallSdr: "0.500",
    steelGrade: "X65",
    manufacturer: "Stupp",
    modelNumber: "",
    heatLotSerial: "H-61002",
    ansiRating: "",
    unit: "ft",
    requiresSerial: false,
    projectNumber: "24-204",
    constructionOrder: "CO-5602",
  },
];
