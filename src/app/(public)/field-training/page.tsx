"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  LineChart,
  BarChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import Link from "next/link";
import {
  Filter,
  AlertTriangle,
  Users,
  FileText,
  TrendingUp,
  X,
  GraduationCap,
  ExternalLink,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { NMH_COLORS, CHART_COLORS } from "@/lib/constants";
import type { FieldTrainingDashboardData } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRatingColor(rating: number): string {
  if (rating <= 2) return NMH_COLORS.orange;
  if (rating === 3) return NMH_COLORS.yellow;
  if (rating === 4) return NMH_COLORS.gray;
  return NMH_COLORS.teal;
}

function getRatingBadgeClass(rating: number): string {
  if (rating <= 2) return "bg-red-100 text-red-700";
  if (rating === 3) return "bg-orange-100 text-orange-700";
  if (rating === 4) return "bg-gray-100 text-gray-700";
  if (rating <= 5) return "bg-green-100 text-green-700";
  return "bg-emerald-100 text-emerald-700";
}

// ---------------------------------------------------------------------------
// Custom Tooltips
// ---------------------------------------------------------------------------

function RatingTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md text-sm">
      <p className="text-muted-foreground mb-1">{label}</p>
      <p className="font-semibold">{payload[0].value.toFixed(1)} / 7</p>
    </div>
  );
}

function CountTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md text-sm">
      <p className="text-muted-foreground mb-1">{label}</p>
      <p className="font-semibold">{payload[0].value} DORs</p>
    </div>
  );
}

function CategoryTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { value: number; payload: { categoryName: string; count: number } }[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md text-sm">
      <p className="text-muted-foreground mb-1">{payload[0].payload.categoryName}</p>
      <p className="font-semibold">{payload[0].value.toFixed(2)} / 7</p>
      <p className="text-xs text-muted-foreground">{payload[0].payload.count} evaluations</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton Loader
// ---------------------------------------------------------------------------

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-[120px] rounded-xl border bg-card p-4 animate-pulse">
          <div className="h-3 w-24 bg-muted rounded mb-3" />
          <div className="h-8 w-20 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function FieldTrainingDashboardPage() {
  const [data, setData] = useState<FieldTrainingDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<string>("ytd");
  const [divisionId, setDivisionId] = useState<string>("");
  const [ftoId, setFtoId] = useState<string>("");
  const [traineeId, setTraineeId] = useState<string>("");
  const [phaseId, setPhaseId] = useState<string>("");

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ range: dateRange });
      if (divisionId) params.set("divisionId", divisionId);
      if (ftoId) params.set("ftoId", ftoId);
      if (traineeId) params.set("traineeId", traineeId);
      if (phaseId) params.set("phaseId", phaseId);
      const res = await fetch(`/api/dashboard/field-training?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      setData(await res.json());
    } catch (err) {
      console.error("Failed to fetch field training data:", err);
    } finally {
      setLoading(false);
    }
  }, [dateRange, divisionId, ftoId, traineeId, phaseId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // -------------------------------------------------------------------------
  // Cascading filters
  // -------------------------------------------------------------------------

  const filteredFtos = useMemo(() => {
    if (!data) return [];
    if (!divisionId) return data.filters.ftos;
    return data.filters.ftos.filter((f) => f.divisionId === divisionId);
  }, [data, divisionId]);

  const filteredTrainees = useMemo(() => {
    if (!data) return [];
    if (!divisionId) return data.filters.trainees;
    return data.filters.trainees.filter((t) => t.divisionId === divisionId);
  }, [data, divisionId]);

  const handleDivisionChange = (val: string) => {
    setDivisionId(val);
    // Clear dependent filters if they're no longer valid
    if (val && ftoId) {
      const ftoStillValid = data?.filters.ftos.find((f) => f.id === ftoId)?.divisionId === val;
      if (!ftoStillValid) setFtoId("");
    }
    if (val && traineeId) {
      const traineeStillValid =
        data?.filters.trainees.find((t) => t.id === traineeId)?.divisionId === val;
      if (!traineeStillValid) setTraineeId("");
    }
  };

  const clearFilters = () => {
    setDivisionId("");
    setFtoId("");
    setTraineeId("");
    setPhaseId("");
  };

  const hasFilters = divisionId || ftoId || traineeId || phaseId;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="px-4 md:px-8 py-6 max-w-[1600px] mx-auto space-y-6">
      {/* 1. Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-nmh-gray">Field Training Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Daily Observation Report performance and trainee evaluation trends
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          <Button
            asChild
            size="lg"
            className="bg-nmh-teal hover:bg-nmh-teal/90 text-white gap-2 shadow-md"
          >
            <Link href="/fieldtraining">
              <GraduationCap className="h-5 w-5" aria-hidden="true" />
              Open FTO/Trainee Portal
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-card rounded-lg border">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>Filters</span>
        </div>

        {/* Division */}
        <Select
          value={divisionId || "__all__"}
          onValueChange={(v) => handleDivisionChange(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Divisions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Divisions</SelectItem>
            {data?.filters.divisions.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* FTO */}
        <Select
          value={ftoId || "__all__"}
          onValueChange={(v) => setFtoId(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All FTOs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All FTOs</SelectItem>
            {filteredFtos.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Trainee */}
        <Select
          value={traineeId || "__all__"}
          onValueChange={(v) => setTraineeId(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Trainees" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Trainees</SelectItem>
            {filteredTrainees.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Phase */}
        <Select
          value={phaseId || "__all__"}
          onValueChange={(v) => setPhaseId(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Phases" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Phases</SelectItem>
            {data?.filters.phases.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear filters */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* 3. Skeleton / Loading State */}
      {loading && !data && <KpiSkeleton />}

      {/* Content: KPIs + Charts + Table */}
      {data && (
        <>
          {/* 4. KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total DORs */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground">Total DORs</span>
                  <FileText className="h-5 w-5 text-nmh-teal" />
                </div>
                <div className="text-3xl font-bold text-nmh-gray">{data.kpis.totalDors}</div>
              </CardContent>
            </Card>

            {/* Avg Overall Rating */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    Avg Overall Rating
                  </span>
                  <TrendingUp className="h-5 w-5 text-nmh-teal" />
                </div>
                <div className="text-3xl font-bold text-nmh-gray">
                  {data.kpis.avgOverallRating.toFixed(1)}
                  <span className="text-lg font-normal text-muted-foreground">/7</span>
                </div>
                {data.kpis.avgRatingSparkline.length > 1 && (
                  <div className="w-24 h-8 mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={data.kpis.avgRatingSparkline.map((v, i) => ({
                          i,
                          v,
                        }))}
                      >
                        <Line
                          type="monotone"
                          dataKey="v"
                          stroke={NMH_COLORS.teal}
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Active Trainees */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground">Active Trainees</span>
                  <Users className="h-5 w-5 text-nmh-teal" />
                </div>
                <div className="text-3xl font-bold text-nmh-gray">{data.kpis.activeTrainees}</div>
              </CardContent>
            </Card>

            {/* NRT/REM Flags */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground">NRT/REM Flags</span>
                  <AlertTriangle
                    className={`h-5 w-5 ${
                      data.kpis.flagCount > 0 ? "text-nmh-orange" : "text-nmh-gray"
                    }`}
                  />
                </div>
                <div className="text-3xl font-bold text-nmh-gray">{data.kpis.flagCount}</div>
              </CardContent>
            </Card>
          </div>

          {/* 8. Empty State — replaces charts & table when no DOR data */}
          {data.kpis.totalDors === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-1">
                  No DOR Data Found
                </h3>
                <p className="text-sm text-muted-foreground">
                  Try adjusting your filters or date range.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* 5. Charts Grid (2x2) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Chart 1: Average Rating Over Time */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-nmh-gray">
                      Average Rating Over Time
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={data.ratingOverTime}
                          margin={{
                            top: 5,
                            right: 10,
                            left: 10,
                            bottom: 5,
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis
                            dataKey="period"
                            tick={{ fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            domain={[1, 7]}
                            tick={{ fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip content={<RatingTooltip />} />
                          <ReferenceLine
                            y={4}
                            stroke={NMH_COLORS.orange}
                            strokeDasharray="6 4"
                            label={{
                              value: "Acceptable",
                              position: "right",
                              fontSize: 10,
                              fill: NMH_COLORS.orange,
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke={NMH_COLORS.teal}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Chart 2: DOR Count Over Time */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-nmh-gray">DOR Count Over Time</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={data.dorCountOverTime}
                          margin={{
                            top: 5,
                            right: 10,
                            left: 10,
                            bottom: 5,
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis
                            dataKey="period"
                            tick={{ fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                          <Tooltip content={<CountTooltip />} />
                          <Bar
                            dataKey="value"
                            fill={NMH_COLORS.orange}
                            radius={[4, 4, 0, 0]}
                            maxBarSize={48}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Chart 3: Rating Distribution (1-7) */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-nmh-gray">Rating Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={data.ratingDistribution}
                          margin={{
                            top: 5,
                            right: 10,
                            left: 10,
                            bottom: 5,
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis
                            dataKey="rating"
                            tick={{ fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                          <Tooltip content={<CountTooltip />} />
                          <Bar dataKey="count" maxBarSize={60} radius={[4, 4, 0, 0]}>
                            {data.ratingDistribution.map((entry) => (
                              <Cell key={entry.rating} fill={getRatingColor(entry.rating)} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Chart 4: Average Rating by Category */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-nmh-gray">
                      Average Rating by Category
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={data.categoryRatings}
                          layout="vertical"
                          margin={{
                            top: 5,
                            right: 20,
                            left: 120,
                            bottom: 5,
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis
                            type="number"
                            domain={[0, 7]}
                            tick={{ fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            type="category"
                            dataKey="categoryName"
                            tick={{ fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                            width={110}
                          />
                          <Tooltip content={<CategoryTooltip />} />
                          <ReferenceLine x={4} stroke={NMH_COLORS.orange} strokeDasharray="6 4" />
                          <Bar dataKey="averageRating" radius={[0, 4, 4, 0]} maxBarSize={24}>
                            {data.categoryRatings.map((entry, idx) => (
                              <Cell
                                key={entry.categoryId}
                                fill={CHART_COLORS[idx % CHART_COLORS.length]}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 7. Recent DORs Table */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-nmh-gray">
                    Recent Daily Observation Reports
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.recentDors.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No DORs found for the selected filters.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Trainee</TableHead>
                          <TableHead>FTO</TableHead>
                          <TableHead>Phase</TableHead>
                          <TableHead className="text-center">Rating</TableHead>
                          <TableHead>Recommendation</TableHead>
                          <TableHead>Flags</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.recentDors.map((dor) => (
                          <TableRow key={dor.id}>
                            <TableCell className="whitespace-nowrap">{dor.date}</TableCell>
                            <TableCell className="font-medium">{dor.traineeName}</TableCell>
                            <TableCell>{dor.ftoName}</TableCell>
                            <TableCell>
                              {dor.phaseName ?? <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={getRatingBadgeClass(dor.overallRating)}>
                                {dor.overallRating}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs capitalize">
                                {dor.recommendAction}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {dor.nrtFlag || dor.remFlag ? (
                                <div className="flex gap-1">
                                  {dor.nrtFlag && (
                                    <Badge className="bg-red-100 text-red-700 text-[10px]">
                                      NRT
                                    </Badge>
                                  )}
                                  {dor.remFlag && (
                                    <Badge className="bg-orange-100 text-orange-700 text-[10px]">
                                      REM
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
