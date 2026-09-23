export type MtrRequestDraft = {
  manufacturer: string;
  projectNumber: string;
  constructionOrder: string;
  requestDate: string;
  description: string;
  sizeInches: string;
  wallSdr: string;
  steelGrade: string;
  modelNumber: string;
  ansiRating: string;
  heatNumber: string;
  lotNumber: string;
  serialNumber: string;
  quantity: string;
  unit: string;
  requestedBy: string;
  notes: string;
};

function line(label: string, value: string) {
  return `${label}: ${value.trim() || "—"}`;
}

export function mtrRequestText(draft: MtrRequestDraft) {
  const qty = [draft.quantity.trim(), draft.unit.trim()].filter(Boolean).join(" ");
  return [
    "MTR REQUEST",
    "Material test report — request only. This is not the mill certificate.",
    "",
    line("To", draft.manufacturer),
    line("Project number", draft.projectNumber),
    line("Construction order", draft.constructionOrder),
    line("Request date", draft.requestDate),
    "",
    line("Description", draft.description),
    line("Size (inches)", draft.sizeInches),
    line("Wall / SDR", draft.wallSdr),
    line("Steel grade", draft.steelGrade),
    line("Model number", draft.modelNumber),
    line("ANSI / pressure rating", draft.ansiRating),
    line("Heat number", draft.heatNumber),
    line("Lot number", draft.lotNumber),
    line("Serial number", draft.serialNumber),
    line("Quantity", qty),
    "",
    line("Requested by", draft.requestedBy),
    "",
    "Notes:",
    draft.notes.trim() || "Please send the material test report for the heat, lot, or serial listed above.",
  ].join("\n");
}

export function emptyMtrDraft(): MtrRequestDraft {
  const today = new Date();
  const requestDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return {
    manufacturer: "",
    projectNumber: "",
    constructionOrder: "",
    requestDate,
    description: "",
    sizeInches: "",
    wallSdr: "",
    steelGrade: "",
    modelNumber: "",
    ansiRating: "",
    heatNumber: "",
    lotNumber: "",
    serialNumber: "",
    quantity: "",
    unit: "",
    requestedBy: "",
    notes: "Please send the material test report for the heat, lot, or serial listed above.",
  };
}
