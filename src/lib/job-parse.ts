export type ExtractedJob = {
  customer_name: string;
  company_name: string;
  contact_info: string;
  project_title: string;
  project_description: string;
  requested_services: string;
  expected_delivery_date: string;
  notes: string;
};

export const EMPTY_JOB: ExtractedJob = {
  customer_name: "",
  company_name: "",
  contact_info: "",
  project_title: "",
  project_description: "",
  requested_services: "",
  expected_delivery_date: "",
  notes: "",
};

import * as XLSX from "xlsx";

const FIELD_HINTS: Record<keyof ExtractedJob, string[]> = {
  customer_name: ["customer", "client name", "client", "contact name", "name"],
  company_name: ["company", "organisation", "organization", "business"],
  contact_info: ["email", "phone", "contact", "mobile", "tel"],
  project_title: ["project title", "title", "project", "job", "subject"],
  project_description: ["description", "details", "brief", "requirement", "scope"],
  requested_services: ["service", "services", "deliverable", "work type", "category"],
  expected_delivery_date: ["delivery", "deadline", "due", "expected date", "date"],
  notes: ["note", "notes", "comment", "remark", "additional"],
};

function normalise(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function toIsoDate(value: string) {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

/** Maps loose key/value pairs from a spreadsheet or document onto job fields. */
export function mapPairsToJob(pairs: [string, string][]): ExtractedJob {
  const result = { ...EMPTY_JOB };
  for (const [rawKey, rawValue] of pairs) {
    const key = normalise(rawKey);
    const value = String(rawValue ?? "").trim();
    if (!key || !value) continue;
    for (const field of Object.keys(FIELD_HINTS) as (keyof ExtractedJob)[]) {
      if (result[field]) continue;
      if (FIELD_HINTS[field].some((hint) => key === hint || key.includes(hint))) {
        result[field] = field === "expected_delivery_date" ? toIsoDate(value) : value;
        break;
      }
    }
  }
  return result;
}

export type ParsedFile = {
  fileName: string;
  /** Table rows when the source was a spreadsheet or CSV. */
  rows: Record<string, string>[];
  /** Raw text when the source was a PDF. */
  text: string;
  job: ExtractedJob;
};

async function parseSheet(file: File): Promise<ParsedFile> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const first = workbook.SheetNames[0];
  const sheet = first ? workbook.Sheets[first] : undefined;
  const rows: Record<string, string>[] = sheet
    ? (XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false }) as Record<string, string>[])
    : [];

  const pairs: [string, string][] = [];
  const firstRow = rows[0];
  if (firstRow) {
    for (const [k, v] of Object.entries(firstRow)) pairs.push([k, String(v ?? "")]);
  }
  // Also support vertical "Label | Value" sheets.
  for (const row of rows) {
    const values = Object.values(row).map((v) => String(v ?? ""));
    if (values.length >= 2 && values[0] && values[1]) {
      pairs.push([values[0], values[1]]);
    }
  }

  return { fileName: file.name, rows, text: "", job: mapPairsToJob(pairs) };
}

async function parsePdf(file: File): Promise<ParsedFile> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const lines: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let current = "";
    let lastY: number | null = null;
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = Math.round((item as { transform: number[] }).transform[5] ?? 0);
      if (lastY !== null && Math.abs(y - lastY) > 3) {
        if (current.trim()) lines.push(current.trim());
        current = "";
      }
      current += item.str + " ";
      lastY = y;
    }
    if (current.trim()) lines.push(current.trim());
  }

  const pairs: [string, string][] = [];
  for (const line of lines) {
    const match = line.match(/^([^:]{2,40}):\s*(.+)$/);
    if (match?.[1] && match[2]) pairs.push([match[1], match[2]]);
  }

  return { fileName: file.name, rows: [], text: lines.join("\n"), job: mapPairsToJob(pairs) };
}

export async function parseJobFile(file: File): Promise<ParsedFile> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return parsePdf(file);
  if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv")) {
    return parseSheet(file);
  }
  throw new Error("Upload an .xlsx, .csv or .pdf file");
}
