"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import Papa from "papaparse";
import { importUploadedData, type ValidatedRow, type TemplateLookupData } from "@/actions/upload";
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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  Download,
  ChevronDown,
  ChevronRight,
  Search,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = "upload" | "preview" | "map" | "validate" | "import" | "done";

type ColumnMapping = {
  metric: string;
  period: string;
  value: string;
  numerator: string;
  denominator: string;
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
  metric: ["metric", "metric_name", "metric name", "kpi", "measure", "indicator"],
  period: ["period", "date", "month", "period_start", "period start", "year", "time"],
  value: ["value", "amount", "count", "result", "score", "total", "number"],
  numerator: ["numerator", "compliant", "events", "num"],
  denominator: ["denominator", "total", "exposure", "denom"],
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

function autoDetectColumn(headers: string[], field: keyof ColumnMapping): string {
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
    (h) => h.name.toLowerCase().includes(n) || n.includes(h.name.toLowerCase())
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
            {idx > 0 && <div className={`h-px w-6 ${isComplete ? "bg-[#00b0ad]" : "bg-border"}`} />}
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

export function UploadClient({ lookup }: { lookup: TemplateLookupData }) {
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
    numerator: "",
    denominator: "",
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
  const [validationResults, setValidationResults] = useState<RowValidation[]>([]);

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

  // Template generator state
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateMetricIds, setTemplateMetricIds] = useState<Set<string>>(new Set());
  const [templateDivisionFilter, setTemplateDivisionFilter] = useState<string>("__all__");
  const [templateDeptFilter, setTemplateDeptFilter] = useState<string>("__all__");
  const [templatePeriodType, setTemplatePeriodType] = useState<string>("monthly");
  const [templateStartDate, setTemplateStartDate] = useState<string>("");
  const [templateEndDate, setTemplateEndDate] = useState<string>("");
  const [templateIncludeScope, setTemplateIncludeScope] = useState(true);
  const [templateMetricSearch, setTemplateMetricSearch] = useState("");

  // Departments (regions) filtered by selected division
  const templateDepts = useMemo(() => {
    if (templateDivisionFilter === "__all__") return lookup.regions;
    return lookup.regions.filter((r) => r.divisionId === templateDivisionFilter);
  }, [lookup.regions, templateDivisionFilter]);

  // Division/department-filtered metrics for template
  // Uses metric associations to determine which metrics are linked to which divisions/departments
  const templateMetrics = useMemo(() => {
    if (templateDivisionFilter === "__all__" && templateDeptFilter === "__all__") {
      return lookup.metrics;
    }

    // Build set of metric IDs associated with the selected division/department
    const matchingMetricIds = new Set<string>();
    for (const a of lookup.associations) {
      if (templateDeptFilter !== "__all__") {
        // Filter by department (region) — must match the regionId
        if (a.regionId === templateDeptFilter) {
          matchingMetricIds.add(a.metricDefinitionId);
        }
      } else if (templateDivisionFilter !== "__all__") {
        // Filter by division — match divisionId directly OR through region's division
        if (a.divisionId === templateDivisionFilter) {
          matchingMetricIds.add(a.metricDefinitionId);
        } else if (a.regionId) {
          const region = lookup.regions.find((r) => r.id === a.regionId);
          if (region?.divisionId === templateDivisionFilter) {
            matchingMetricIds.add(a.metricDefinitionId);
          }
        }
      }
    }

    return lookup.metrics.filter((m) => matchingMetricIds.has(m.id));
  }, [
    lookup.metrics,
    lookup.associations,
    lookup.regions,
    templateDivisionFilter,
    templateDeptFilter,
  ]);

  // Search-filtered metrics for display in the checklist
  const displayedMetrics = useMemo(() => {
    if (!templateMetricSearch.trim()) return templateMetrics;
    const q = templateMetricSearch.toLowerCase().trim();
    return templateMetrics.filter((m) => m.name.toLowerCase().includes(q));
  }, [templateMetrics, templateMetricSearch]);

  // Generate template CSV and trigger download
  const downloadTemplate = useCallback(() => {
    // Build period list from start/end dates
    const periods: string[] = [];
    if (templateStartDate) {
      const startParts = templateStartDate.split("-");
      const startYear = parseInt(startParts[0]);
      const startMonth = parseInt(startParts[1]) - 1;

      if (templateEndDate) {
        const endParts = templateEndDate.split("-");
        const endYear = parseInt(endParts[0]);
        const endMonth = parseInt(endParts[1]) - 1;

        if (templatePeriodType === "monthly") {
          let y = startYear,
            m = startMonth;
          while (y < endYear || (y === endYear && m <= endMonth)) {
            periods.push(`${y}-${String(m + 1).padStart(2, "0")}`);
            m++;
            if (m > 11) {
              m = 0;
              y++;
            }
          }
        } else if (templatePeriodType === "quarterly") {
          // Snap start to quarter start
          let y = startYear,
            q = Math.floor(startMonth / 3);
          const endQ = Math.floor(endMonth / 3);
          while (y < endYear || (y === endYear && q <= endQ)) {
            const qMonth = q * 3 + 1;
            periods.push(`${y}-${String(qMonth).padStart(2, "0")}`);
            q++;
            if (q > 3) {
              q = 0;
              y++;
            }
          }
        } else if (templatePeriodType === "annual") {
          for (let y = startYear; y <= endYear; y++) {
            periods.push(`${y}-01`);
          }
        } else {
          // daily, weekly, bi-weekly — just use the start date
          periods.push(templateStartDate);
        }
      } else {
        // Single period
        periods.push(templateStartDate.length <= 7 ? templateStartDate : templateStartDate);
      }
    }

    // If no periods specified, use empty string (user fills in)
    if (periods.length === 0) periods.push("");

    // Get selected metrics
    const selectedMetrics = lookup.metrics.filter((m) => templateMetricIds.has(m.id));
    if (selectedMetrics.length === 0) return;

    // Build associations map
    const assocMap: Record<string, { divisionIds: string[]; regionIds: string[] }> = {};
    for (const a of lookup.associations) {
      if (!assocMap[a.metricDefinitionId]) {
        assocMap[a.metricDefinitionId] = { divisionIds: [], regionIds: [] };
      }
      if (a.divisionId) assocMap[a.metricDefinitionId].divisionIds.push(a.divisionId);
      if (a.regionId) assocMap[a.metricDefinitionId].regionIds.push(a.regionId);
    }

    // Determine if any selected metrics are rate/proportion type
    const hasRateMetrics = selectedMetrics.some(
      (m) => m.dataType === "rate" || m.dataType === "proportion"
    );

    // Build rows — include Numerator/Denominator columns when rate/proportion metrics are selected
    const rows: string[][] = [];

    // Helper to build a row with the right number of columns
    const buildRow = (
      metricName: string,
      period: string,
      divName: string,
      regionName: string,
      metric: (typeof selectedMetrics)[0]
    ): string[] => {
      const isComponent = metric.dataType === "rate" || metric.dataType === "proportion";
      if (hasRateMetrics) {
        // 8 columns: Metric, Period, Value, Numerator, Denominator, Division, Department, Notes
        // For rate/proportion: leave Value blank, user fills Numerator + Denominator
        // For continuous: user fills Value, leave Numerator + Denominator blank
        return [
          metricName,
          period,
          isComponent ? "" : "", // Value — always empty in template
          isComponent ? "" : "", // Numerator — user fills for rate/proportion
          isComponent ? "" : "", // Denominator — user fills for rate/proportion
          divName,
          regionName,
          "",
        ];
      } else {
        // 6 columns: Metric, Period, Value, Division, Department, Notes
        return [metricName, period, "", divName, regionName, ""];
      }
    };

    for (const metric of selectedMetrics) {
      const assoc = assocMap[metric.id];

      for (const period of periods) {
        if (templateIncludeScope && assoc) {
          // Region-level rows
          const regionIds = assoc.regionIds.length > 0 ? assoc.regionIds : [];

          // Filter to selected division/department if needed
          let filteredRegionIds = regionIds;
          if (templateDeptFilter !== "__all__") {
            filteredRegionIds = regionIds.filter((rId) => rId === templateDeptFilter);
          } else if (templateDivisionFilter !== "__all__") {
            filteredRegionIds = regionIds.filter((rId) => {
              const region = lookup.regions.find((r) => r.id === rId);
              return region?.divisionId === templateDivisionFilter;
            });
          }

          if (filteredRegionIds.length > 0) {
            // One row per region
            for (const regionId of filteredRegionIds) {
              const region = lookup.regions.find((r) => r.id === regionId);
              const division = region
                ? lookup.divisions.find((d) => d.id === region.divisionId)
                : null;
              rows.push(
                buildRow(metric.name, period, division?.name ?? "", region?.name ?? "", metric)
              );
            }
          } else {
            // Division-level rows
            const divIds = assoc.divisionIds.length > 0 ? assoc.divisionIds : [];

            const filteredDivIds =
              templateDivisionFilter !== "__all__"
                ? divIds.filter((id) => id === templateDivisionFilter)
                : divIds;

            if (filteredDivIds.length > 0) {
              for (const divId of filteredDivIds) {
                const div = lookup.divisions.find((d) => d.id === divId);
                rows.push(buildRow(metric.name, period, div?.name ?? "", "", metric));
              }
            } else {
              // No associations — single row
              rows.push(buildRow(metric.name, period, "", "", metric));
            }
          }
        } else {
          // No scope expansion — one row per metric+period
          rows.push(buildRow(metric.name, period, "", "", metric));
        }
      }
    }

    // Build header row — include Numerator/Denominator columns with custom labels when needed
    let fields: string[];
    if (hasRateMetrics) {
      // Collect unique numerator/denominator labels from selected rate/proportion metrics
      const rateMetrics = selectedMetrics.filter(
        (m) => m.dataType === "rate" || m.dataType === "proportion"
      );
      const numLabels = new Set(
        rateMetrics.map((m) => {
          if (m.dataType === "proportion") return m.numeratorLabel || "Compliant";
          return m.numeratorLabel || "Events";
        })
      );
      const denLabels = new Set(
        rateMetrics.map((m) => {
          if (m.dataType === "proportion") return m.denominatorLabel || "Total";
          return m.denominatorLabel || "Exposure";
        })
      );

      // If all rate metrics share the same label, use it; otherwise use generic with examples
      const numHeader = numLabels.size === 1 ? `Numerator (${[...numLabels][0]})` : `Numerator`;
      const denHeader = denLabels.size === 1 ? `Denominator (${[...denLabels][0]})` : `Denominator`;

      fields = [
        "Metric",
        "Period",
        "Value",
        numHeader,
        denHeader,
        "Division",
        "Department",
        "Notes",
      ];
    } else {
      fields = ["Metric", "Period", "Value", "Division", "Department", "Notes"];
    }

    // Generate CSV with PapaParse
    const csv = Papa.unparse({
      fields,
      data: rows,
    });

    // Trigger download
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const dateSuffix = new Date().toISOString().slice(0, 10);
    link.download = `upload-template-${dateSuffix}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [
    templateMetricIds,
    templatePeriodType,
    templateStartDate,
    templateEndDate,
    templateDivisionFilter,
    templateDeptFilter,
    templateIncludeScope,
    lookup,
  ]);

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------

  const filteredMetrics = useMemo(() => {
    return lookup.metrics;
  }, [lookup.metrics]);

  const filteredDivisions = useMemo(() => {
    return lookup.divisions;
  }, [lookup.divisions]);

  const validCount = validationResults.filter((r) => r.status === "valid").length;
  const errorCount = validationResults.filter((r) => r.status === "error").length;
  const warningCount = validationResults.filter((r) => r.status === "warning").length;

  // -------------------------------------------------------------------------
  // File handling
  // -------------------------------------------------------------------------

  const handleFile = useCallback((file: File) => {
    setParseError(null);

    if (file.size > 5 * 1024 * 1024) {
      setParseError("File too large. Maximum size is 5 MB.");
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "tsv", "txt"].includes(ext ?? "")) {
      setParseError("Unsupported file type. Please upload a .csv, .tsv, or .txt file.");
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
          setParseError("File appears empty or has only headers. Need at least one data row.");
          return;
        }

        const headers = data[0];
        const rows = data.slice(1);

        if (rows.length > 10_000) {
          setParseError(`Too many rows (${rows.length}). Maximum is 10,000 per upload.`);
          return;
        }

        setRawHeaders(headers);
        setRawRows(rows);

        // Auto-detect column mappings
        const autoMapping: ColumnMapping = {
          metric: autoDetectColumn(headers, "metric"),
          period: autoDetectColumn(headers, "period"),
          value: autoDetectColumn(headers, "value"),
          numerator: autoDetectColumn(headers, "numerator"),
          denominator: autoDetectColumn(headers, "denominator"),
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
  }, []);

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
    const numColIdx = rawHeaders.indexOf(mapping.numerator);
    const denColIdx = rawHeaders.indexOf(mapping.denominator);
    const deptColIdx = rawHeaders.indexOf(mapping.department);
    const divColIdx = rawHeaders.indexOf(mapping.division);
    const indColIdx = rawHeaders.indexOf(mapping.region);
    const notesColIdx = rawHeaders.indexOf(mapping.notes);

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNum = i + 2; // +2 for 1-indexed + header row

      // --- Metric (resolve first so we know the dataType) ---
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

      const metricDef = lookup.metrics.find((m) => m.id === metricId);
      const isComponentMetric =
        metricDef?.dataType === "rate" || metricDef?.dataType === "proportion";

      // --- Value / Numerator / Denominator ---
      let value: number;
      let numerator: number | null = null;
      let denominator: number | null = null;

      // Check if numerator & denominator columns are mapped and have values
      const rawNum = numColIdx >= 0 ? row[numColIdx]?.replace(/[$,%]/g, "").trim() : "";
      const rawDen = denColIdx >= 0 ? row[denColIdx]?.replace(/[$,%]/g, "").trim() : "";
      const hasComponents = rawNum !== "" && rawDen !== "";

      if (hasComponents) {
        // Parse numerator and denominator
        numerator = parseFloat(rawNum);
        denominator = parseFloat(rawDen);

        if (isNaN(numerator)) {
          results.push({
            row: rowNum,
            status: "error",
            message: `Invalid numerator: "${row[numColIdx] ?? ""}"`,
          });
          continue;
        }
        if (isNaN(denominator)) {
          results.push({
            row: rowNum,
            status: "error",
            message: `Invalid denominator: "${row[denColIdx] ?? ""}"`,
          });
          continue;
        }
        if (denominator === 0) {
          results.push({
            row: rowNum,
            status: "error",
            message: `Denominator cannot be zero`,
          });
          continue;
        }

        // Calculate value from components
        if (metricDef?.dataType === "rate" && metricDef.rateMultiplier) {
          value = (numerator / denominator) * metricDef.rateMultiplier;
        } else {
          // Proportion or rate without multiplier: numerator / denominator
          value = numerator / denominator;
        }
      } else {
        // Fall back to Value column
        const rawValue = valueColIdx >= 0 ? row[valueColIdx]?.replace(/[$,%]/g, "").trim() : "";
        value = parseFloat(rawValue);
        if (isNaN(value)) {
          if (isComponentMetric && numColIdx < 0) {
            results.push({
              row: rowNum,
              status: "error",
              message: `Rate/proportion metric requires Numerator and Denominator columns, or a Value`,
            });
          } else {
            results.push({
              row: rowNum,
              status: "error",
              message: `Invalid value: "${row[valueColIdx] ?? ""}"`,
            });
          }
          continue;
        }
      }

      // --- Department (auto-resolved from metric) ---
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
        periodDate = new Date(`${parts[0]}-${parts[1]}-${parts[2] ?? "01"}T00:00:00.000Z`);
      } else if (/^\d{1,2}\/\d{4}$/.test(rawPeriod)) {
        // "1/2025" or "01/2025"
        const [m, y] = rawPeriod.split("/");
        periodDate = new Date(`${y}-${m.padStart(2, "0")}-01T00:00:00.000Z`);
      } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(rawPeriod)) {
        // "1/1/2025" or "01/01/2025"
        const [m, d, y] = rawPeriod.split("/");
        periodDate = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00.000Z`);
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
        divisionId = fuzzyMatch(row[divColIdx].trim(), lookup.divisions) ?? null;
      }

      // --- Region (optional) ---
      let regionId: string | null = null;
      if (indColIdx >= 0 && row[indColIdx]?.trim()) {
        const divRegions = divisionId
          ? lookup.regions.filter((r) => r.divisionId === divisionId)
          : lookup.regions;
        regionId = fuzzyMatch(row[indColIdx].trim(), divRegions) ?? null;
      }

      // --- Notes ---
      const notes = notesColIdx >= 0 && row[notesColIdx]?.trim() ? row[notesColIdx].trim() : null;

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
          numerator,
          denominator,
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
      numerator: "",
      denominator: "",
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
      {/* Template Generator (visible on upload step) */}
      {/* ================================================================== */}
      {step === "upload" && (
        <Card>
          <CardHeader className="cursor-pointer" onClick={() => setTemplateOpen(!templateOpen)}>
            <CardTitle className="flex items-center gap-2 text-nmh-gray">
              <Download className="size-5" />
              Download Template
              {templateOpen ? (
                <ChevronDown className="size-4 ml-auto text-muted-foreground" />
              ) : (
                <ChevronRight className="size-4 ml-auto text-muted-foreground" />
              )}
            </CardTitle>
          </CardHeader>
          {templateOpen && (
            <CardContent className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Generate a pre-filled CSV template with the correct columns and rows. Select metrics
                and options, then download and fill in the values.
              </p>

              {/* Division & Department filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Filter by Division</Label>
                  <Select
                    value={templateDivisionFilter}
                    onValueChange={(v) => {
                      setTemplateDivisionFilter(v);
                      setTemplateDeptFilter("__all__");
                      setTemplateMetricIds(new Set());
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Divisions</SelectItem>
                      {lookup.divisions.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Filter by Department</Label>
                  <Select
                    value={templateDeptFilter}
                    onValueChange={(v) => {
                      setTemplateDeptFilter(v);
                      setTemplateMetricIds(new Set());
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Departments</SelectItem>
                      {templateDepts.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Metric selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>
                    Metrics <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() =>
                        setTemplateMetricIds(new Set(templateMetrics.map((m) => m.id)))
                      }
                    >
                      Select All
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setTemplateMetricIds(new Set())}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search metrics..."
                    className="pl-9"
                    value={templateMetricSearch}
                    onChange={(e) => setTemplateMetricSearch(e.target.value)}
                  />
                </div>
                <div className="border rounded-lg max-h-[200px] overflow-y-auto p-2 space-y-1">
                  {templateMetrics.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No metrics found for the selected filters.
                    </p>
                  ) : displayedMetrics.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No metrics match &ldquo;{templateMetricSearch}&rdquo;
                    </p>
                  ) : (
                    displayedMetrics.map((m) => (
                      <label
                        key={m.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm"
                      >
                        <Checkbox
                          checked={templateMetricIds.has(m.id)}
                          onCheckedChange={(checked) => {
                            setTemplateMetricIds((prev) => {
                              const next = new Set(prev);
                              if (checked) next.add(m.id);
                              else next.delete(m.id);
                              return next;
                            });
                          }}
                        />
                        <span className="truncate">{m.name}</span>
                        <Badge variant="outline" className="ml-auto text-[10px] shrink-0">
                          {m.unit}
                        </Badge>
                      </label>
                    ))
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {templateMetricIds.size} metric{templateMetricIds.size !== 1 ? "s" : ""} selected
                </p>
              </div>

              <Separator />

              {/* Period & scope options */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Period Type</Label>
                  <Select value={templatePeriodType} onValueChange={setTemplatePeriodType}>
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

                <div className="space-y-2">
                  <Label>Start Period</Label>
                  <Input
                    type={templatePeriodType === "daily" ? "date" : "month"}
                    value={templateStartDate}
                    onChange={(e) => setTemplateStartDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    End Period <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    type={templatePeriodType === "daily" ? "date" : "month"}
                    value={templateEndDate}
                    onChange={(e) => setTemplateEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 h-9 cursor-pointer">
                  <Checkbox
                    checked={templateIncludeScope}
                    onCheckedChange={(v) => setTemplateIncludeScope(!!v)}
                  />
                  <span className="text-sm">Expand rows by division/department</span>
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Creates separate rows for each associated division or department per metric,
                  filtered by the selections above.
                </p>
              </div>

              {/* Download button */}
              <div className="flex items-center justify-between pt-2 border-t">
                <p className="text-sm text-muted-foreground">
                  {templateMetricIds.size > 0
                    ? `Template will include ${templateMetricIds.size} metric${templateMetricIds.size !== 1 ? "s" : ""}${templateStartDate ? ` starting ${templateStartDate}` : ""}`
                    : "Select at least one metric to generate a template"}
                </p>
                <Button
                  onClick={downloadTemplate}
                  disabled={templateMetricIds.size === 0}
                  className="bg-[#00b0ad] hover:bg-[#00383d] text-white gap-2"
                >
                  <Download className="size-4" />
                  Download CSV Template
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}

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
                <button onClick={() => setParseError(null)} className="ml-auto">
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
              <p className="text-lg font-medium mb-1">Drag & drop your CSV file here</p>
              <p className="text-sm text-muted-foreground mb-4">or click to browse files</p>
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
                Your CSV should include columns for at least: <strong>Metric Name</strong>,{" "}
                <strong>Period</strong> (e.g. 2025-01 or 01/2025), and either <strong>Value</strong>{" "}
                or <strong>Numerator + Denominator</strong> (for rate/proportion metrics). Optional
                columns: Department, Division, Region, Notes. Headers are auto-detected.
              </p>
              <div className="bg-muted/50 rounded-lg p-3 text-xs font-mono overflow-x-auto">
                <pre>{`Metric,Period,Value,Numerator,Denominator,Division,Department,Notes\nTotal Calls,2025-01,1523,,,Air Care,,\nCompliance Rate,2025-01,,45,50,Ground Ambulance,,`}</pre>
              </div>
              <p className="text-[11px] text-muted-foreground">
                For rate/proportion metrics, provide Numerator and Denominator — the system will
                automatically calculate the value and use the components for control chart limits
                (UCL/LCL).
              </p>
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
              <Badge variant="outline">{rawRows.length.toLocaleString()} rows</Badge>
              <Badge variant="outline">{(fileSize / 1024).toFixed(1)} KB</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Here are the first 10 rows of your file. Verify the data looks correct, then proceed
              to map columns.
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
              Map your CSV columns to the dashboard fields. Auto-detected mappings are pre-selected
              — adjust as needed.
            </p>

            {/* Fixed overrides section */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-4">
              <h4 className="text-sm font-medium">
                Scope Overrides{" "}
                <span className="text-muted-foreground font-normal">(apply to all rows)</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>
                    Fixed Division{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Select
                    value={fixedDivision}
                    onValueChange={(v) => setFixedDivision(v === "auto" ? "" : v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Auto-detect from CSV" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-detect from CSV</SelectItem>
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
                  { field: "metric" as const, label: "Metric Name", required: true, hint: "" },
                  { field: "period" as const, label: "Period / Date", required: true, hint: "" },
                  {
                    field: "value" as const,
                    label: "Value",
                    required: false,
                    hint: "Direct value — or use Numerator + Denominator below for rate/proportion metrics",
                  },
                  {
                    field: "numerator" as const,
                    label: "Numerator",
                    required: false,
                    hint: "For rate/proportion metrics (e.g., Compliant, Events)",
                  },
                  {
                    field: "denominator" as const,
                    label: "Denominator",
                    required: false,
                    hint: "For rate/proportion metrics (e.g., Total, Exposure)",
                  },
                  {
                    field: "department" as const,
                    label: "Department",
                    required: !fixedDepartment,
                    hint: "",
                  },
                  { field: "division" as const, label: "Division", required: false, hint: "" },
                  { field: "region" as const, label: "Region", required: false, hint: "" },
                  { field: "notes" as const, label: "Notes", required: false, hint: "" },
                ] as const
              ).map(({ field, label, required, hint }) => (
                <div key={field} className="space-y-2">
                  <Label>
                    {label}
                    {required && <span className="text-red-500 ml-0.5">*</span>}
                    {!required && (
                      <span className="text-muted-foreground font-normal ml-1">(optional)</span>
                    )}
                    {field === "department" && fixedDepartment && (
                      <Badge variant="outline" className="ml-2 text-[10px] text-[#00b0ad]">
                        Using fixed override
                      </Badge>
                    )}
                    {field === "division" && fixedDivision && (
                      <Badge variant="outline" className="ml-2 text-[10px] text-[#00b0ad]">
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
                            <span className="ml-1 text-[#00b0ad]">(auto-detected)</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
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
                  (!mapping.value && !(mapping.numerator && mapping.denominator)) ||
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
                <Badge variant="outline" className="gap-1 text-red-700 border-red-300 bg-red-50">
                  <XCircle className="size-3" />
                  {errorCount} errors
                </Badge>
              )}
              <Badge variant="outline">{rawRows.length} total rows</Badge>
            </div>

            {errorCount > 0 && (
              <div className="text-sm text-muted-foreground">
                Rows with errors will be skipped during import. Only <strong>{validCount}</strong>{" "}
                valid rows will be imported.
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
                      ? (lookup.metrics.find((m) => m.id === result.data!.metricDefinitionId)
                          ?.name ?? "—")
                      : "—";
                    const periodDisplay = result.data
                      ? new Date(result.data.periodStart).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                        })
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
                          {result.status === "error" && <XCircle className="size-4 text-red-600" />}
                        </TableCell>
                        <TableCell className="text-sm">{metricName}</TableCell>
                        <TableCell className="text-sm">{periodDisplay}</TableCell>
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
            <p className="text-lg font-medium">Importing {validCount} rows...</p>
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
                <h3 className="text-xl font-bold text-red-700">Import Failed</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {importResult.error}
                </p>
                {importResult.created > 0 && (
                  <p className="text-sm text-green-700">
                    {importResult.created} rows were successfully imported before the error.
                  </p>
                )}
              </>
            ) : (
              <>
                <CheckCircle className="size-12 mx-auto text-green-600" />
                <h3 className="text-xl font-bold text-green-700">Import Complete!</h3>
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
              <Button onClick={resetWizard} className="bg-[#00b0ad] hover:bg-[#00383d] text-white">
                Upload Another File
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
