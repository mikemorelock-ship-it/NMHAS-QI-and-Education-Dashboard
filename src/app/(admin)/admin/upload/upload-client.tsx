"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import Papa from "papaparse";
import {
  importUploadedData,
  type ValidatedRow,
  type LookupData,
} from "@/actions/upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  X,
  Trash2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = "upload" | "preview" | "map" | "validate" | "import" | "done";

type ColumnMapping = {
  metric: string;
  period: string;
  value: string;
  department: string;
  division: string;
  region: string;
  notes: string;
};

type RowValidation = {
  row: number;
  status: "valid" | "warning" | "error";
  message?: string;
  data?: ValidatedRow;
};

// ---------------------------------------------------------------------------
// Auto-detection helpers
// ---------------------------------------------------------------------------

const HEADER_HINTS: Record<keyof ColumnMapping, string[]> = {
  metric: [
    "metric",
    "metric_name",
    "metric name",
    "kpi",
    "measure",
    "indicator",
  ],
  period: [
    "period",
    "date",
    "month",
    "period_start",
    "period start",
    "year",
    "time",
  ],
  value: ["value", "amount", "count", "result", "score", "total", "number"],
  department: ["department", "dept", "department_name", "department name"],
  division: ["division", "unit", "group", "section", "division_name"],
  region: [
    "region",
    "individual",
    "person",
    "employee",
    "name",
    "individual_name",
    "base",
    "helicopter",
  ],
  notes: ["notes", "note", "comment", "comments", "description"],
};

function autoDetectColumn(
  headers: string[],
  field: keyof ColumnMapping
): string {
  const hints = HEADER_HINTS[field];
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const hint of hints) {
    const idx = lower.findIndex((h) => h === hint || h.includes(hint));
    if (idx !== -1) return headers[idx];
  }
  return "";
}

function fuzzyMatch(
  needle: string,
  haystack: Array<{ id: string; name: string; slug?: string }>
): string | null {
  const n = needle.toLowerCase().trim();
  if (!n) return null;

  // Exact match on name
  const exact = haystack.find((h) => h.name.toLowerCase() === n);
  if (exact) return exact.id;

  // Exact match on slug
  const slugMatch = haystack.find((h) => h.slug?.toLowerCase() === n);
  if (slugMatch) return slugMatch.id;

  // Contains match
  const contains = haystack.find(
    (h) =>
      h.name.toLowerCase().includes(n) || n.includes(h.name.toLowerCase())
  );
  if (contains) return contains.id;

  return null;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StepIndicator({ current, steps }: { current: Step; steps: Step[] }) {
  const labels: Record<Step, string> = {
    upload: "Upload",
    preview: "Preview",
    map: "Map Columns",
    validate: "Validate",
    import: "Import",
    done: "Complete",
  };

  const currentIdx = steps.indexOf(current);

  return (
    <div className="flex items-center gap-2">
      {steps.map((step, idx) => {
        const isActive = idx === currentIdx;
        const isComplete = idx < currentIdx;
        return (
          <div key={step} className="flex items-center gap-2">
            {idx > 0 && (
              <div
                className={`h-px w-6 ${
                  isComplete ? "bg-[#00b0ad]" : "bg-border"
                }`}
              />
            )}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isActive
                  ? "bg-[#00b0ad] text-white"
                  : isComplete
                    ? "bg-[#00b0ad]/10 text-[#00b0ad]"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {isComplete && <CheckCircle className="size-3" />}
              <span>
                {idx + 1}. {labels[step]}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function UploadClient({ lookup }: { lookup: LookupData }) {
  // Wizard state
  const [step, setStep] = useState<Step>("upload");

  // File / parsing
  const [fileName, setFileName] = useState<string>("");
  const [fileSize, setFileSize] = useState<number>(0);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  // Column mapping
  const [mapping, setMapping] = useState<ColumnMapping>({
    metric: "",
    period: "",
    value: "",
    department: "",
    division: "",
    region: "",
    notes: "",
  });
  // fixedDepartment removed — department is auto-resolved from metric
  const fixedDepartment = ""; // kept as empty string for backward compat
  const [fixedDivision, setFixedDivision] = useState<string>("");
  const [periodType, setPeriodType] = useState<string>("monthly");

  // Validation
  const [validationResults, setValidationResults] = useState<RowValidation[]>(
    []
  );

  // Import
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    created: number;
    skipped: number;
    error?: string;
  } | null>(null);

  // Drag state
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------

  const filteredMetrics = useMemo(() => {
    return lookup.metrics;
  }, [lookup.metrics]);

  const filteredDivisions = useMemo(() => {
    return lookup.divisions;
  }, [lookup.divisions]);

  const validCount = validationResults.filter(
    (r) => r.status === "valid"
  ).length;
  const errorCount = validationResults.filter(
    (r) => r.status === "error"
  ).length;
  const warningCount = validationResults.filter(
    (r) => r.status === "warning"
  ).length;

  // -------------------------------------------------------------------------
  // File handling
  // -------------------------------------------------------------------------

  const handleFile = useCallback(
    (file: File) => {
      setParseError(null);

      if (file.size > 5 * 1024 * 1024) {
        setParseError("File too large. Maximum size is 5 MB.");
        return;
      }

      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["csv", "tsv", "txt"].includes(ext ?? "")) {
        setParseError(
          "Unsupported file type. Please upload a .csv, .tsv, or .txt file."
        );
        return;
      }

      setFileName(file.name);
      setFileSize(file.size);

      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          const data = results.data as string[][];
          if (data.length < 2) {
            setParseError(
              "File appears empty or has only headers. Need at least one data row."
            );
            return;
          }

          const headers = data[0];
          const rows = data.slice(1);

          if (rows.length > 10_000) {
            setParseError(
              `Too many rows (${rows.length}). Maximum is 10,000 per upload.`
            );
            return;
          }

          setRawHeaders(headers);
          setRawRows(rows);

          // Auto-detect column mappings
          const autoMapping: ColumnMapping = {
            metric: autoDetectColumn(headers, "metric"),
            period: autoDetectColumn(headers, "period"),
            value: autoDetectColumn(headers, "value"),
            department: autoDetectColumn(headers, "department"),
            division: autoDetectColumn(headers, "division"),
            region: autoDetectColumn(headers, "region"),
            notes: autoDetectColumn(headers, "notes"),
          };
          setMapping(autoMapping);

          setStep("preview");
        },
        error: (err) => {
          setParseError(`Failed to parse file: ${err.message}`);
        },
      });
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  const runValidation = useCallback(() => {
    const results: RowValidation[] = [];

    const metricColIdx = rawHeaders.indexOf(mapping.metric);
    const periodColIdx = rawHeaders.indexOf(mapping.period);
    const valueColIdx = rawHeaders.indexOf(mapping.value);
    const deptColIdx = rawHeaders.indexOf(mapping.department);
    const divColIdx = rawHeaders.indexOf(mapping.division);
    const indColIdx = rawHeaders.indexOf(mapping.region);
    const notesColIdx = rawHeaders.indexOf(mapping.notes);

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNum = i + 2; // +2 for 1-indexed + header row

      // --- Value ---
      const rawValue =
        valueColIdx >= 0
          ? row[valueColIdx]?.replace(/[$,%]/g, "").trim()
          : "";
      const value = parseFloat(rawValue);
      if (isNaN(value)) {
        results.push({
          row: rowNum,
          status: "error",
          message: `Invalid value: "${row[valueColIdx] ?? ""}"`,
        });
        continue;
      }

      // --- Metric ---
      const rawMetric = metricColIdx >= 0 ? row[metricColIdx]?.trim() : "";
      const metricId = fuzzyMatch(rawMetric, filteredMetrics);
      if (!metricId) {
        results.push({
          row: rowNum,
          status: "error",
          message: `Unknown metric: "${rawMetric}"`,
        });
        continue;
      }

      // --- Department (auto-resolved from metric) ---
      const metricDef = lookup.metrics.find((m) => m.id === metricId);
      const departmentId = metricDef?.departmentId ?? "";
      if (!departmentId) {
        results.push({
          row: rowNum,
          status: "error",
          message: `Could not resolve department for metric "${rawMetric}"`,
        });
        continue;
      }

      // --- Period ---
      const rawPeriod = periodColIdx >= 0 ? row[periodColIdx]?.trim() : "";
      let periodDate: Date | null = null;

      // Try various date formats
      if (/^\d{4}-\d{2}(-\d{2})?$/.test(rawPeriod)) {
        // "2025-01" or "2025-01-01"
        const parts = rawPeriod.split("-");
        periodDate = new Date(
          `${parts[0]}-${parts[1]}-${parts[2] ?? "01"}T00:00:00.000Z`
        );
      } else if (/^\d{1,2}\/\d{4}$/.test(rawPeriod)) {
        // "1/2025" or "01/2025"
        const [m, y] = rawPeriod.split("/");
        periodDate = new Date(`${y}-${m.padStart(2, "0")}-01T00:00:00.000Z`);
      } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(rawPeriod)) {
        // "1/1/2025" or "01/01/2025"
        const [m, d, y] = rawPeriod.split("/");
        periodDate = new Date(
          `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00.000Z`
        );
      } else {
        // Try native Date parse
        const attempt = new Date(rawPeriod);
        if (!isNaN(attempt.getTime())) {
          periodDate = attempt;
        }
      }

      if (!periodDate || isNaN(periodDate.getTime())) {
        results.push({
          row: rowNum,
          status: "error",
          message: `Invalid date: "${rawPeriod}". Use YYYY-MM, YYYY-MM-DD, or MM/YYYY.`,
        });
        continue;
      }

      // --- Division (optional) ---
      let divisionId: string | null = null;
      if (fixedDivision) {
        divisionId = fixedDivision;
      } else if (divColIdx >= 0 && row[divColIdx]?.trim()) {
        divisionId =
          fuzzyMatch(
            row[divColIdx].trim(),
            lookup.divisions
          ) ?? null;
      }

      // --- Region (optional) ---
      let regionId: string | null = null;
      if (indColIdx >= 0 && row[indColIdx]?.trim()) {
        const divRegions = divisionId
          ? lookup.regions.filter((r) => r.divisionId === divisionId)
          : lookup.regions;
        regionId =
          fuzzyMatch(row[indColIdx].trim(), divRegions) ?? null;
      }

      // --- Notes ---
      const notes =
        notesColIdx >= 0 && row[notesColIdx]?.trim()
          ? row[notesColIdx].trim()
          : null;

      results.push({
        row: rowNum,
        status: "valid",
        data: {
          metricDefinitionId: metricId,
          departmentId,
          divisionId,
          regionId,
          periodType,
          periodStart: periodDate.toISOString(),
          value,
          notes,
          numerator: null,
          denominator: null,
        },
      });
    }

    setValidationResults(results);
    setStep("validate");
  }, [
    rawHeaders,
    rawRows,
    mapping,
    fixedDepartment,
    fixedDivision,
    periodType,
    filteredMetrics,
    lookup,
  ]);

  // -------------------------------------------------------------------------
  // Import
  // -------------------------------------------------------------------------

  const handleImport = useCallback(async () => {
    const validRows = validationResults
      .filter((r) => r.status === "valid" && r.data)
      .map((r) => r.data!);

    if (validRows.length === 0) {
      setImportResult({ created: 0, skipped: 0, error: "No valid rows." });
      setStep("done");
      return;
    }

    setImporting(true);
    setStep("import");

    try {
      const result = await importUploadedData(validRows);
      setImportResult({
        created: result.created ?? 0,
        skipped: result.skipped ?? 0,
        error: result.error,
      });
    } catch (err) {
      setImportResult({
        created: 0,
        skipped: 0,
        error: "An unexpected error occurred during import.",
      });
    }

    setImporting(false);
    setStep("done");
  }, [validationResults]);

  // -------------------------------------------------------------------------
  // Reset
  // -------------------------------------------------------------------------

  const resetWizard = useCallback(() => {
    setStep("upload");
    setFileName("");
    setFileSize(0);
    setRawHeaders([]);
    setRawRows([]);
    setParseError(null);
    setMapping({
      metric: "",
      period: "",
      value: "",
      department: "",
      division: "",
      region: "",
      notes: "",
    });
    setFixedDivision("");
    setPeriodType("monthly");
    setValidationResults([]);
    setImporting(false);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const steps: Step[] = ["upload", "preview", "map", "validate", "import", "done"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-nmh-gray">Upload Data</h1>
        <p className="text-muted-foreground mt-1">
          Import metric data from CSV files. Max 5 MB / 10,000 rows.
        </p>
      </div>

      <StepIndicator current={step} steps={steps} />

      {/* ================================================================== */}
      {/* Step 1: Upload */}
      {/* ================================================================== */}
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-nmh-gray">
              <Upload className="size-5" />
              Upload CSV File
            </CardTitle>
          </CardHeader>
          <CardContent>
            {parseError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                <XCircle className="size-4 shrink-0" />
                {parseError}
                <button
                  onClick={() => setParseError(null)}
                  className="ml-auto"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
                transition-colors
                ${
                  dragOver
                    ? "border-[#00b0ad] bg-[#00b0ad]/5"
                    : "border-border hover:border-[#00b0ad]/50 hover:bg-muted/30"
                }
              `}
            >
              <FileSpreadsheet className="size-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-1">
                Drag & drop your CSV file here
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                or click to browse files
              </p>
              <Badge variant="outline" className="text-xs">
                .csv, .tsv, .txt — Max 5 MB
              </Badge>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>

            <div className="mt-6 space-y-2">
              <h4 className="text-sm font-medium">Expected format</h4>
              <p className="text-xs text-muted-foreground">
                Your CSV should include columns for at least:{" "}
                <strong>Metric Name</strong>, <strong>Period</strong> (e.g.
                2025-01 or 01/2025), and <strong>Value</strong>. Optional
                columns: Department, Division, Region, Notes. Headers are
                auto-detected.
              </p>
              <div className="bg-muted/50 rounded-lg p-3 text-xs font-mono overflow-x-auto">
                <pre>{`Metric,Period,Value,Department,Division,Notes\nTotal Calls,2025-01,1523,Clinical and Operational Metrics,Air Care,\nAvg Response Time,2025-01,8.2,Clinical and Operational Metrics,Ground Ambulance,`}</pre>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ================================================================== */}
      {/* Step 2: Preview */}
      {/* ================================================================== */}
      {step === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-nmh-gray">
              <FileSpreadsheet className="size-5" />
              File Preview
              <Badge variant="outline" className="ml-2">
                {fileName}
              </Badge>
              <Badge variant="outline">
                {rawRows.length.toLocaleString()} rows
              </Badge>
              <Badge variant="outline">
                {(fileSize / 1024).toFixed(1)} KB
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Here are the first 10 rows of your file. Verify the data looks
              correct, then proceed to map columns.
            </p>

            <div className="border rounded-lg overflow-x-auto max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    {rawHeaders.map((h, i) => (
                      <TableHead key={i} className="whitespace-nowrap">
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rawRows.slice(0, 10).map((row, rowIdx) => (
                    <TableRow key={rowIdx}>
                      <TableCell className="text-center text-muted-foreground text-xs">
                        {rowIdx + 2}
                      </TableCell>
                      {rawHeaders.map((_, colIdx) => (
                        <TableCell key={colIdx} className="whitespace-nowrap">
                          {row[colIdx] ?? ""}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {rawRows.length > 10 && (
              <p className="text-xs text-muted-foreground text-center">
                Showing first 10 of {rawRows.length.toLocaleString()} rows
              </p>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" onClick={resetWizard}>
                <ArrowLeft className="size-4" />
                Start Over
              </Button>
              <Button
                onClick={() => setStep("map")}
                className="bg-[#00b0ad] hover:bg-[#00383d] text-white"
              >
                Map Columns
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ================================================================== */}
      {/* Step 3: Column Mapping */}
      {/* ================================================================== */}
      {step === "map" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-nmh-gray">Column Mapping</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Map your CSV columns to the dashboard fields. Auto-detected
              mappings are pre-selected — adjust as needed.
            </p>

            {/* Fixed overrides section */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-4">
              <h4 className="text-sm font-medium">
                Scope Overrides{" "}
                <span className="text-muted-foreground font-normal">
                  (apply to all rows)
                </span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>
                    Fixed Division{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </Label>
                  <Select
                    value={fixedDivision}
                    onValueChange={(v) =>
                      setFixedDivision(v === "auto" ? "" : v)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Auto-detect from CSV" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">
                        Auto-detect from CSV
                      </SelectItem>
                      {filteredDivisions.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Period Type</Label>
                  <Select value={periodType} onValueChange={setPeriodType}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="bi-weekly">Bi-Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Column mapping grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(
                [
                  {
                    field: "metric" as const,
                    label: "Metric Name",
                    required: true,
                  },
                  {
                    field: "period" as const,
                    label: "Period / Date",
                    required: true,
                  },
                  {
                    field: "value" as const,
                    label: "Value",
                    required: true,
                  },
                  {
                    field: "department" as const,
                    label: "Department",
                    required: !fixedDepartment,
                  },
                  {
                    field: "division" as const,
                    label: "Division",
                    required: false,
                  },
                  {
                    field: "region" as const,
                    label: "Region",
                    required: false,
                  },
                  {
                    field: "notes" as const,
                    label: "Notes",
                    required: false,
                  },
                ] as const
              ).map(({ field, label, required }) => (
                <div key={field} className="space-y-2">
                  <Label>
                    {label}
                    {required && (
                      <span className="text-red-500 ml-0.5">*</span>
                    )}
                    {!required && (
                      <span className="text-muted-foreground font-normal ml-1">
                        (optional)
                      </span>
                    )}
                    {field === "department" && fixedDepartment && (
                      <Badge
                        variant="outline"
                        className="ml-2 text-[10px] text-[#00b0ad]"
                      >
                        Using fixed override
                      </Badge>
                    )}
                    {field === "division" && fixedDivision && (
                      <Badge
                        variant="outline"
                        className="ml-2 text-[10px] text-[#00b0ad]"
                      >
                        Using fixed override
                      </Badge>
                    )}
                  </Label>
                  <Select
                    value={mapping[field] || "none"}
                    onValueChange={(v) =>
                      setMapping((prev) => ({
                        ...prev,
                        [field]: v === "none" ? "" : v,
                      }))
                    }
                    disabled={
                      (field === "department" && !!fixedDepartment) ||
                      (field === "division" && !!fixedDivision)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Not mapped" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- Not mapped --</SelectItem>
                      {rawHeaders.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                          {h === mapping[field] && (
                            <span className="ml-1 text-[#00b0ad]">
                              (auto-detected)
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" onClick={() => setStep("preview")}>
                <ArrowLeft className="size-4" />
                Back
              </Button>
              <Button
                onClick={runValidation}
                disabled={
                  !mapping.metric ||
                  !mapping.period ||
                  !mapping.value ||
                  (!mapping.department && !fixedDepartment)
                }
                className="bg-[#00b0ad] hover:bg-[#00383d] text-white"
              >
                Validate Data
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ================================================================== */}
      {/* Step 4: Validation Results */}
      {/* ================================================================== */}
      {step === "validate" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-nmh-gray">Validation Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary badges */}
            <div className="flex items-center gap-3 flex-wrap">
              <Badge
                variant="outline"
                className="gap-1 text-green-700 border-green-300 bg-green-50"
              >
                <CheckCircle className="size-3" />
                {validCount} valid
              </Badge>
              {warningCount > 0 && (
                <Badge
                  variant="outline"
                  className="gap-1 text-yellow-700 border-yellow-300 bg-yellow-50"
                >
                  <AlertTriangle className="size-3" />
                  {warningCount} warnings
                </Badge>
              )}
              {errorCount > 0 && (
                <Badge
                  variant="outline"
                  className="gap-1 text-red-700 border-red-300 bg-red-50"
                >
                  <XCircle className="size-3" />
                  {errorCount} errors
                </Badge>
              )}
              <Badge variant="outline">
                {rawRows.length} total rows
              </Badge>
            </div>

            {errorCount > 0 && (
              <div className="text-sm text-muted-foreground">
                Rows with errors will be skipped during import. Only{" "}
                <strong>{validCount}</strong> valid rows will be imported.
              </div>
            )}

            {/* Validation table */}
            <div className="border rounded-lg overflow-x-auto max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Row</TableHead>
                    <TableHead className="w-16">Status</TableHead>
                    <TableHead>Metric</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validationResults.map((result, idx) => {
                    const metricName = result.data
                      ? lookup.metrics.find(
                          (m) => m.id === result.data!.metricDefinitionId
                        )?.name ?? "—"
                      : "—";
                    const periodDisplay = result.data
                      ? new Date(result.data.periodStart).toLocaleDateString(
                          "en-US",
                          { year: "numeric", month: "short" }
                        )
                      : "—";

                    return (
                      <TableRow
                        key={idx}
                        className={
                          result.status === "error"
                            ? "bg-red-50/50"
                            : result.status === "warning"
                              ? "bg-yellow-50/50"
                              : ""
                        }
                      >
                        <TableCell className="text-xs text-muted-foreground">
                          {result.row}
                        </TableCell>
                        <TableCell>
                          {result.status === "valid" && (
                            <CheckCircle className="size-4 text-green-600" />
                          )}
                          {result.status === "warning" && (
                            <AlertTriangle className="size-4 text-yellow-600" />
                          )}
                          {result.status === "error" && (
                            <XCircle className="size-4 text-red-600" />
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {metricName}
                        </TableCell>
                        <TableCell className="text-sm">
                          {periodDisplay}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {result.data?.value ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {result.message ?? ""}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" onClick={() => setStep("map")}>
                <ArrowLeft className="size-4" />
                Back to Mapping
              </Button>
              <Button
                onClick={handleImport}
                disabled={validCount === 0}
                className="bg-[#00b0ad] hover:bg-[#00383d] text-white"
              >
                Import {validCount} Rows
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ================================================================== */}
      {/* Step 5: Importing */}
      {/* ================================================================== */}
      {step === "import" && importing && (
        <Card>
          <CardContent className="py-16 text-center space-y-4">
            <Loader2 className="size-10 mx-auto animate-spin text-[#00b0ad]" />
            <p className="text-lg font-medium">
              Importing {validCount} rows...
            </p>
            <p className="text-sm text-muted-foreground">
              This may take a moment for large uploads.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ================================================================== */}
      {/* Step 6: Done */}
      {/* ================================================================== */}
      {step === "done" && importResult && (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            {importResult.error ? (
              <>
                <XCircle className="size-12 mx-auto text-red-500" />
                <h3 className="text-xl font-bold text-red-700">
                  Import Failed
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {importResult.error}
                </p>
                {importResult.created > 0 && (
                  <p className="text-sm text-green-700">
                    {importResult.created} rows were successfully imported before
                    the error.
                  </p>
                )}
              </>
            ) : (
              <>
                <CheckCircle className="size-12 mx-auto text-green-600" />
                <h3 className="text-xl font-bold text-green-700">
                  Import Complete!
                </h3>
                <p className="text-lg">
                  <strong>{importResult.created}</strong> entries created
                </p>
                {importResult.skipped > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {importResult.skipped} rows skipped (duplicates)
                  </p>
                )}
              </>
            )}

            <div className="pt-4">
              <Button
                onClick={resetWizard}
                className="bg-[#00b0ad] hover:bg-[#00383d] text-white"
              >
                Upload Another File
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
