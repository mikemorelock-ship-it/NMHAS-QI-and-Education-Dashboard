"use server";

import { requireAdmin } from "@/lib/require-auth";
import Papa from "papaparse";
import pdfParse from "pdf-parse";
import * as XLSX from "xlsx";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ParseResult =
  | { success: true; text: string; fileName: string; fileType: string }
  | { success: false; error: string };

// Max file size: 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const SUPPORTED_TYPES: Record<string, string> = {
  "text/csv": "csv",
  "application/vnd.ms-excel": "excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "excel",
  "application/pdf": "pdf",
};

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

function parseCsv(buffer: Buffer): string {
  const text = buffer.toString("utf-8");
  const result = Papa.parse(text, { header: true, skipEmptyLines: true });

  if (result.errors.length > 0 && result.data.length === 0) {
    throw new Error("Failed to parse CSV: " + result.errors[0].message);
  }

  const rows = result.data as Record<string, unknown>[];
  if (rows.length === 0) return "Empty CSV file — no data rows found.";

  // Format as a readable table
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(" | ")];
  lines.push(headers.map(() => "---").join(" | "));

  for (const row of rows.slice(0, 500)) {
    lines.push(headers.map((h) => String(row[h] ?? "")).join(" | "));
  }

  if (rows.length > 500) {
    lines.push(`\n... and ${rows.length - 500} more rows (truncated)`);
  }

  return lines.join("\n");
}

async function parsePdf(buffer: Buffer): Promise<string> {
  const result = await pdfParse(buffer);
  const text = result.text.trim();

  if (!text) {
    return "PDF appears to contain no extractable text (it may be a scanned image — try uploading a screenshot instead).";
  }

  // Truncate very long PDFs
  if (text.length > 20000) {
    return text.slice(0, 20000) + "\n\n... (truncated — document too long)";
  }

  return text;
}

function parseExcel(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheets: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });

    if (!data.trim()) continue;

    // Parse the CSV output into a readable table
    const result = Papa.parse(data, { header: true, skipEmptyLines: true });
    const rows = result.data as Record<string, unknown>[];

    if (rows.length === 0) continue;

    const headers = Object.keys(rows[0]);
    const lines = [`## Sheet: ${sheetName}`, ""];
    lines.push(headers.join(" | "));
    lines.push(headers.map(() => "---").join(" | "));

    for (const row of rows.slice(0, 500)) {
      lines.push(headers.map((h) => String(row[h] ?? "")).join(" | "));
    }

    if (rows.length > 500) {
      lines.push(`\n... and ${rows.length - 500} more rows (truncated)`);
    }

    sheets.push(lines.join("\n"));
  }

  if (sheets.length === 0) {
    return "Excel file appears to be empty — no data found in any sheet.";
  }

  return sheets.join("\n\n");
}

// ---------------------------------------------------------------------------
// Server action
// ---------------------------------------------------------------------------

export async function parseDocument(formData: FormData): Promise<ParseResult> {
  try {
    await requireAdmin("enter_metric_data");
  } catch {
    return { success: false, error: "Insufficient permissions." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "No file provided." };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { success: false, error: "File is too large. Maximum size is 10MB." };
  }

  const fileType = SUPPORTED_TYPES[file.type];

  // Also check by extension as a fallback
  const ext = file.name.split(".").pop()?.toLowerCase();
  const extType =
    ext === "csv"
      ? "csv"
      : ext === "pdf"
        ? "pdf"
        : ["xlsx", "xls"].includes(ext ?? "")
          ? "excel"
          : null;

  const resolvedType = fileType ?? extType;

  if (!resolvedType) {
    return {
      success: false,
      error: `Unsupported file type: ${file.type || ext}. Supported: CSV, Excel (.xlsx/.xls), PDF.`,
    };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let text: string;
    switch (resolvedType) {
      case "csv":
        text = parseCsv(buffer);
        break;
      case "pdf":
        text = await parsePdf(buffer);
        break;
      case "excel":
        text = parseExcel(buffer);
        break;
      default:
        return { success: false, error: "Unsupported file type." };
    }

    return {
      success: true,
      text,
      fileName: file.name,
      fileType: resolvedType,
    };
  } catch (err) {
    console.error("[parseDocument] Error:", err);
    return {
      success: false,
      error: `Failed to parse ${resolvedType} file. Please check the file format and try again.`,
    };
  }
}
