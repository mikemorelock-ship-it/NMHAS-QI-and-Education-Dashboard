"use client";

import { useState, useCallback } from "react";
import Papa from "papaparse";
import { format } from "date-fns";
import {
  exportMetricData,
  exportDorData,
  exportTrainingProgress,
  exportAuditLog,
  exportUserRoster,
  type ReportsLookupData,
  type MetricDataRow,
  type DorDataRow,
  type TrainingProgressRow,
  type AuditLogRow,
  type UserRosterRow,
  type MetricDataFilters,
  type DorDataFilters,
  type TrainingProgressFilters,
  type AuditLogFilters,
  type UserRosterFilters,
} from "@/actions/reports";
import { ROLE_LABELS, USER_ROLES } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileBarChart,
  Download,
  Loader2,
  ClipboardList,
  GraduationCap,
  Shield,
  Users,
  BarChart3,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReportTab = "metrics" | "dors" | "training" | "audit" | "users";

type AnyRow = MetricDataRow | DorDataRow | TrainingProgressRow | AuditLogRow | UserRosterRow;

// ---------------------------------------------------------------------------
// Download helper
// ---------------------------------------------------------------------------

function downloadCsv(data: Record<string, unknown>[], filename: string) {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ReportsClientProps {
  lookup: ReportsLookupData;
}

export function ReportsClient({ lookup }: ReportsClientProps) {
  const [activeTab, setActiveTab] = useState<ReportTab>("metrics");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnyRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  // --- Metric filters ---
  const [metricFilters, setMetricFilters] = useState<MetricDataFilters>({});
  // --- DOR filters ---
  const [dorFilters, setDorFilters] = useState<DorDataFilters>({});
  // --- Training filters ---
  const [trainingFilters, setTrainingFilters] = useState<TrainingProgressFilters>({});
  // --- Audit filters ---
  const [auditFilters, setAuditFilters] = useState<AuditLogFilters>({});
  // --- User filters ---
  const [userFilters, setUserFilters] = useState<UserRosterFilters>({});

  // Reset data when switching tabs
  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab as ReportTab);
    setData([]);
    setTotalCount(0);
    setError(null);
  }, []);

  // Generate report
  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setData([]);
    setTotalCount(0);

    try {
      let result: AnyRow[];

      switch (activeTab) {
        case "metrics":
          result = await exportMetricData(metricFilters);
          break;
        case "dors":
          result = await exportDorData(dorFilters);
          break;
        case "training":
          result = await exportTrainingProgress(trainingFilters);
          break;
        case "audit":
          result = await exportAuditLog(auditFilters);
          break;
        case "users":
          result = await exportUserRoster(userFilters);
          break;
        default:
          result = [];
      }

      setTotalCount(result.length);
      setData(result);
    } catch (err) {
      console.error("Report generation error:", err);
      setError(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setLoading(false);
    }
  }, [activeTab, metricFilters, dorFilters, trainingFilters, auditFilters, userFilters]);

  // Download CSV
  const handleDownload = useCallback(() => {
    if (data.length === 0) return;
    const timestamp = format(new Date(), "yyyy-MM-dd_HHmmss");
    const filename = `${activeTab}-report_${timestamp}.csv`;

    if (activeTab === "metrics") {
      // Build sectioned CSV with custom headers per metric
      const csvContent = buildSectionedMetricCsv(data as MetricDataRow[]);
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      downloadCsv(data as Record<string, unknown>[], filename);
    }
  }, [data, activeTab]);

  // Get column headers from data
  // For metrics, hide metadata columns and use custom labels for numerator/denominator
  const metricMetaCols = new Set(["dataType", "numeratorLabel", "denominatorLabel"]);
  const rawColumns = data.length > 0 ? Object.keys(data[0] as Record<string, unknown>) : [];
  const columns =
    activeTab === "metrics" ? rawColumns.filter((c) => !metricMetaCols.has(c)) : rawColumns;

  // For metrics, derive custom header labels from first row
  const metricCustomHeaders: Record<string, string> = {};
  if (activeTab === "metrics" && data.length > 0) {
    const firstRow = data[0] as MetricDataRow;
    metricCustomHeaders["numerator"] = firstRow.numeratorLabel || "Numerator";
    metricCustomHeaders["denominator"] = firstRow.denominatorLabel || "Denominator";
  }

  // Preview is first 10 rows
  const previewData = data.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FileBarChart className="h-6 w-6 text-nmh-teal" />
          Reports &amp; Data Export
        </h1>
        <p className="text-muted-foreground mt-1">
          Generate and download CSV reports for metric data, DORs, training progress, audit logs,
          and user rosters.
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
          <TabsTrigger value="metrics" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Metric Data
          </TabsTrigger>
          <TabsTrigger value="dors" className="gap-1.5">
            <ClipboardList className="h-4 w-4" />
            DOR Export
          </TabsTrigger>
          <TabsTrigger value="training" className="gap-1.5">
            <GraduationCap className="h-4 w-4" />
            Training Progress
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5">
            <Shield className="h-4 w-4" />
            Audit Log
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5">
            <Users className="h-4 w-4" />
            User Roster
          </TabsTrigger>
        </TabsList>

        {/* --- Metric Data Tab --- */}
        <TabsContent value="metrics">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Metric Data Export</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Metric</Label>
                  <Select
                    value={metricFilters.metricIds?.[0] ?? "__all__"}
                    onValueChange={(v) =>
                      setMetricFilters((f) => ({
                        ...f,
                        metricIds: v === "__all__" ? undefined : [v],
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Metrics" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Metrics</SelectItem>
                      {lookup.metrics.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Division</Label>
                  <Select
                    value={metricFilters.divisionId ?? "__all__"}
                    onValueChange={(v) =>
                      setMetricFilters((f) => ({
                        ...f,
                        divisionId: v === "__all__" ? undefined : v,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Divisions" />
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
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={metricFilters.startDate ?? ""}
                    onChange={(e) =>
                      setMetricFilters((f) => ({
                        ...f,
                        startDate: e.target.value || undefined,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={metricFilters.endDate ?? ""}
                    onChange={(e) =>
                      setMetricFilters((f) => ({
                        ...f,
                        endDate: e.target.value || undefined,
                      }))
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- DOR Export Tab --- */}
        <TabsContent value="dors">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Daily Observation Report Export</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Trainee</Label>
                  <Select
                    value={dorFilters.traineeIds?.[0] ?? "__all__"}
                    onValueChange={(v) =>
                      setDorFilters((f) => ({
                        ...f,
                        traineeIds: v === "__all__" ? undefined : [v],
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Trainees" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Trainees</SelectItem>
                      {lookup.trainees.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                          {t.employeeId ? ` (${t.employeeId})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>FTO</Label>
                  <Select
                    value={dorFilters.ftoIds?.[0] ?? "__all__"}
                    onValueChange={(v) =>
                      setDorFilters((f) => ({
                        ...f,
                        ftoIds: v === "__all__" ? undefined : [v],
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All FTOs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All FTOs</SelectItem>
                      {lookup.ftos.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                          {f.employeeId ? ` (${f.employeeId})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Phase</Label>
                  <Select
                    value={dorFilters.phaseId ?? "__all__"}
                    onValueChange={(v) =>
                      setDorFilters((f) => ({
                        ...f,
                        phaseId: v === "__all__" ? undefined : v,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Phases" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Phases</SelectItem>
                      {lookup.phases.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={dorFilters.startDate ?? ""}
                    onChange={(e) =>
                      setDorFilters((f) => ({
                        ...f,
                        startDate: e.target.value || undefined,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={dorFilters.endDate ?? ""}
                    onChange={(e) =>
                      setDorFilters((f) => ({
                        ...f,
                        endDate: e.target.value || undefined,
                      }))
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Training Progress Tab --- */}
        <TabsContent value="training">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Training Progress Export</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Trainee</Label>
                  <Select
                    value={trainingFilters.traineeIds?.[0] ?? "__all__"}
                    onValueChange={(v) =>
                      setTrainingFilters((f) => ({
                        ...f,
                        traineeIds: v === "__all__" ? undefined : [v],
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Trainees" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Trainees</SelectItem>
                      {lookup.trainees.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                          {t.employeeId ? ` (${t.employeeId})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Trainee Status</Label>
                  <Select
                    value={trainingFilters.status ?? "__all__"}
                    onValueChange={(v) =>
                      setTrainingFilters((f) => ({
                        ...f,
                        status: v === "__all__" ? undefined : v,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="separated">Separated</SelectItem>
                      <SelectItem value="remediation">Remediation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Audit Log Tab --- */}
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Audit Log Export</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Action</Label>
                  <Select
                    value={auditFilters.action ?? "__all__"}
                    onValueChange={(v) =>
                      setAuditFilters((f) => ({
                        ...f,
                        action: v === "__all__" ? undefined : v,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Actions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Actions</SelectItem>
                      {lookup.auditActions.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Entity</Label>
                  <Select
                    value={auditFilters.entity ?? "__all__"}
                    onValueChange={(v) =>
                      setAuditFilters((f) => ({
                        ...f,
                        entity: v === "__all__" ? undefined : v,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Entities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Entities</SelectItem>
                      {lookup.auditEntities.map((e) => (
                        <SelectItem key={e} value={e}>
                          {e}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={auditFilters.startDate ?? ""}
                    onChange={(e) =>
                      setAuditFilters((f) => ({
                        ...f,
                        startDate: e.target.value || undefined,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={auditFilters.endDate ?? ""}
                    onChange={(e) =>
                      setAuditFilters((f) => ({
                        ...f,
                        endDate: e.target.value || undefined,
                      }))
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- User Roster Tab --- */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">User Roster Export</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={userFilters.role ?? "__all__"}
                    onValueChange={(v) =>
                      setUserFilters((f) => ({
                        ...f,
                        role: v === "__all__" ? undefined : v,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Roles</SelectItem>
                      {USER_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Account Status</Label>
                  <Select
                    value={userFilters.status ?? "__all__"}
                    onValueChange={(v) =>
                      setUserFilters((f) => ({
                        ...f,
                        status: v === "__all__" ? undefined : v,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="disabled">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleGenerate}
          disabled={loading}
          className="bg-nmh-teal hover:bg-nmh-teal/90"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <FileBarChart className="h-4 w-4 mr-2" />
              Generate Report
            </>
          )}
        </Button>

        {data.length > 0 && (
          <Button onClick={handleDownload} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Download CSV ({totalCount.toLocaleString()} rows)
          </Button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Preview table */}
      {data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Preview ({Math.min(10, data.length)} of {totalCount.toLocaleString()} rows)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((col) => (
                      <TableHead key={col} className="whitespace-nowrap text-xs font-semibold">
                        {metricCustomHeaders[col] || formatColumnHeader(col)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((row, rowIdx) => (
                    <TableRow key={rowIdx}>
                      {columns.map((col) => (
                        <TableCell
                          key={col}
                          className="whitespace-nowrap text-xs max-w-[300px] truncate"
                          title={String((row as Record<string, unknown>)[col] ?? "")}
                        >
                          {String((row as Record<string, unknown>)[col] ?? "")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {activeTab === "metrics" &&
              data.length > 0 &&
              (() => {
                const uniqueMetrics = new Set((data as MetricDataRow[]).map((r) => r.metricName));
                return uniqueMetrics.size > 1 ? (
                  <p className="text-xs text-muted-foreground mt-3">
                    <strong>{uniqueMetrics.size} metrics</strong> selected &mdash; the downloaded
                    CSV will be sectioned by metric, each with its own custom column headers.
                  </p>
                ) : null;
              })()}
            {data.length > 10 && (
              <p className="text-xs text-muted-foreground mt-3">
                Showing first 10 rows. Download the CSV to see all {totalCount.toLocaleString()}{" "}
                rows.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty state after generation */}
      {data.length === 0 && totalCount === 0 && !loading && !error && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileBarChart className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground">
              Select a report type, configure filters, and click &ldquo;Generate Report&rdquo; to
              preview data.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metric CSV builder — sectioned by metric with custom headers
// ---------------------------------------------------------------------------

function buildSectionedMetricCsv(rows: MetricDataRow[]): string {
  // Group rows by metric name (preserving order from server)
  const metricGroups = new Map<
    string,
    { dataType: string; numLabel: string; denLabel: string; rows: MetricDataRow[] }
  >();

  for (const row of rows) {
    const key = row.metricName;
    if (!metricGroups.has(key)) {
      metricGroups.set(key, {
        dataType: row.dataType,
        numLabel: row.numeratorLabel,
        denLabel: row.denominatorLabel,
        rows: [],
      });
    }
    metricGroups.get(key)!.rows.push(row);
  }

  const uniqueMetrics = metricGroups.size;
  const lines: string[] = [];

  for (const [metricName, group] of metricGroups) {
    const isContinuous = group.dataType === "continuous";

    // Add section header if multiple metrics
    if (uniqueMetrics > 1) {
      const typeLabel =
        group.dataType === "proportion"
          ? "Proportion"
          : group.dataType === "rate"
            ? "Rate"
            : "Continuous";
      lines.push(`--- ${metricName} (${typeLabel}) ---`);
    }

    // Build headers — use custom labels for numerator/denominator
    const headers = [
      "Metric",
      "Department",
      "Division",
      "Region",
      "Period Type",
      "Period Start",
      "Value",
    ];
    if (!isContinuous) {
      headers.push(group.numLabel, group.denLabel);
    }
    headers.push("Notes");
    lines.push(headers.map(csvEscapeField).join(","));

    // Build data rows
    for (const row of group.rows) {
      const fields: string[] = [
        row.metricName,
        row.department,
        row.division,
        row.region,
        row.periodType,
        row.periodStart,
        String(row.value),
      ];
      if (!isContinuous) {
        fields.push(row.numerator, row.denominator);
      }
      fields.push(row.notes);
      lines.push(fields.map(csvEscapeField).join(","));
    }

    // Blank line between sections
    if (uniqueMetrics > 1) {
      lines.push("");
    }
  }

  return lines.join("\n");
}

/** Escape a CSV field value — wrap in quotes if it contains commas, quotes, or newlines */
function csvEscapeField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert camelCase column keys to readable headers */
function formatColumnHeader(key: string): string {
  // Handle rating_ prefix for DOR category columns
  if (key.startsWith("rating_")) {
    return key.replace("rating_", "") + " Rating";
  }
  // Convert camelCase to Title Case
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}
