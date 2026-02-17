export interface KpiData {
  metricId: string;
  metricSlug: string;
  divisionSlug: string;
  name: string;
  currentValue: number;
  previousValue: number;
  unit: string;
  target: number | null;
  trend: number;
  sparkline: number[];
  chartType: string;
  category: string | null;
  aggregationType?: string;
  rateMultiplier?: number | null;
  rateSuffix?: string | null;
}

export interface DivisionOverview {
  id: string;
  name: string;
  slug: string;
  kpis: KpiData[];
}

export interface ChartDataPoint {
  period: string;
  value: number;
  numerator?: number;
  denominator?: number;
}

export interface MetricChartData {
  id: string;
  slug: string;
  name: string;
  unit: string;
  chartType: string;
  category: string | null;
  target: number | null;
  data: ChartDataPoint[];
  rateMultiplier?: number | null;
  rateSuffix?: string | null;
}

export interface DivisionSummary {
  id: string;
  name: string;
  slug: string;
}

// Detail data for a single Division (used by /api/dashboard/[slug])
export interface DivisionDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  departments: Array<{ id: string; name: string }>; // regions/individuals
  kpis: KpiData[];
  metrics: MetricChartData[];
}

export interface MetricAnnotation {
  id: string;
  date: string;
  title: string;
  description: string | null;
  type: "intervention" | "milestone" | "event";
}

export interface MetricResource {
  id: string;
  title: string;
  url: string;
  type: "document" | "link" | "reference" | "protocol";
}

export interface MetricResponsibleParty {
  id: string;
  name: string;
  role: string;
  email: string | null;
}

export interface DivisionMetricBreakdown {
  divisionId: string;
  divisionName: string;
  divisionSlug: string;
  currentValue: number;
  trend: number;
  data: ChartDataPoint[];
}

export interface ChildMetricSummary {
  id: string;
  name: string;
  slug: string;
  currentValue: number;
  trend: number;
  data: ChartDataPoint[];
}

// ---------------------------------------------------------------------------
// SPC (Statistical Process Control) Types
// ---------------------------------------------------------------------------

export interface SPCPointData {
  period: string;
  value: number;
  ucl: number;
  lcl: number;
  centerLine: number;
  specialCause: boolean;
  specialCauseRules: string[];
}

export interface SPCMovingRangeData {
  period: string;
  value: number;
  ucl: number;
  lcl: number;
  centerLine: number;
}

export interface SPCChartData {
  chartType: "p-chart" | "u-chart" | "i-mr";
  centerLine: number;
  points: SPCPointData[];
  movingRange?: SPCMovingRangeData[];
}

// ---------------------------------------------------------------------------
// Metric Detail Data
// ---------------------------------------------------------------------------

export interface MetricDetailData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  dataDefinition: string | null;
  methodology: string | null;
  unit: string;
  format: string | null;
  chartType: string;
  category: string | null;
  target: number | null;
  division: {
    id: string;
    name: string;
    slug: string;
  };
  parentMetric: { id: string; name: string; slug: string } | null;
  siblingMetrics: { id: string; name: string; slug: string }[];
  childMetrics: ChildMetricSummary[];
  chartData: ChartDataPoint[];
  stats: {
    current: number;
    previous: number;
    trend: number;
    average: number;
    min: number;
    max: number;
    count: number;
  };
  annotations: MetricAnnotation[];
  resources: MetricResource[];
  responsibleParties: MetricResponsibleParty[];
  divisionBreakdown: DivisionMetricBreakdown[];
  /** Optional organizational hierarchy for the org-chart visualization */
  hierarchy?: Array<{
    id: string;
    name: string;
    slug: string;
    departments: Array<{ id: string; name: string }>;
  }>;
  /** The old Department (Organization) entity — kept for backward compat */
  department?: { id: string; name: string; slug: string };
  /** Rate display fields */
  rateMultiplier?: number | null;
  rateSuffix?: string | null;
  /** SPC fields */
  dataType?: "proportion" | "rate" | "continuous";
  spcSigmaLevel?: number;
  baselineStart?: string | null;
  baselineEnd?: string | null;
  spcData?: SPCChartData;
}

// ---------------------------------------------------------------------------
// Scorecard Types
// ---------------------------------------------------------------------------

export interface ScorecardMonthlyValue {
  month: string; // "Jan", "Feb", etc.
  periodStart: string; // ISO date string
  value: number | null;
}

export interface ScorecardMetricRow {
  metricId: string;
  metricName: string;
  unit: string;
  aggregationType: string;
  target: number | null;
  targetYtd: number | null;
  actualYtd: number | null;
  monthlyValues: ScorecardMonthlyValue[];
  meetsTarget: boolean | null; // null if no target defined
  rateMultiplier?: number | null;
  rateSuffix?: string | null;
  groupName?: string | null; // admin-defined section header for visual grouping
}

export interface ScorecardPresetData {
  id: string;
  name: string;
  divisionIds: string[];
  divisionNames: string[];
  regionIds: string[];
  regionNames: string[];
  metricIds: string[];
  sortOrder: number;
}

export interface ScorecardData {
  metrics: ScorecardMetricRow[];
  months: string[]; // Month abbreviations with data: ["Jan", "Feb", ...]
  year: number;
  presets: ScorecardPresetData[];
}

export interface FilterOptions {
  divisions: Array<{ id: string; name: string }>;
  regions: Array<{ id: string; name: string; divisionId: string }>;
}

// ---------------------------------------------------------------------------
// Driver Diagram Types
// ---------------------------------------------------------------------------

export interface DriverNodeData {
  id: string;
  parentId: string | null;
  type: "aim" | "primary" | "secondary" | "changeIdea";
  text: string;
  description: string | null;
  sortOrder: number;
  children: DriverNodeData[];
  pdsaCycleCount?: number;
}

export interface DriverDiagramData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: "draft" | "active" | "archived";
  isActive: boolean;
  sortOrder: number;
  metricDefinitionId: string | null;
  metricName: string | null;
  nodes: DriverNodeData[];
  pdsaCycleCount: number;
}

export interface DriverDiagramSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: "draft" | "active" | "archived";
  isActive: boolean;
  sortOrder: number;
  metricName: string | null;
  nodeCount: number;
  pdsaCycleCount: number;
}

// ---------------------------------------------------------------------------
// PDSA Cycle Types
// ---------------------------------------------------------------------------

export type PdsaStatus = "planning" | "doing" | "studying" | "acting" | "completed" | "abandoned";
export type PdsaOutcome = "adopt" | "adapt" | "abandon";

export interface PdsaCycleSummary {
  id: string;
  title: string;
  cycleNumber: number;
  status: PdsaStatus;
  outcome: PdsaOutcome | null;
  driverDiagramId: string | null;
  driverDiagramName: string | null;
  metricDefinitionId: string | null;
  metricName: string | null;
  changeIdeaNodeId: string | null;
  changeIdeaText: string | null;
  planStartDate: string | null;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Field Training Dashboard Types
// ---------------------------------------------------------------------------

export interface FieldTrainingFilters {
  divisions: Array<{ id: string; name: string }>;
  ftos: Array<{ id: string; name: string; divisionId: string | null }>;
  trainees: Array<{ id: string; name: string; divisionId: string | null; status: string }>;
  phases: Array<{ id: string; name: string }>;
}

export interface FieldTrainingTimePoint {
  period: string;
  value: number;
  count?: number;
}

export interface CategoryRatingData {
  categoryId: string;
  categoryName: string;
  averageRating: number;
  count: number;
}

export interface RatingDistribution {
  rating: number;
  count: number;
}

export interface RecentDOR {
  id: string;
  date: string;
  traineeName: string;
  ftoName: string;
  phaseName: string | null;
  overallRating: number;
  recommendAction: string;
  nrtFlag: boolean;
  remFlag: boolean;
}

export interface FieldTrainingDashboardData {
  kpis: {
    totalDors: number;
    avgOverallRating: number;
    avgRatingSparkline: number[];
    activeTrainees: number;
    flagCount: number;
  };
  ratingOverTime: FieldTrainingTimePoint[];
  dorCountOverTime: FieldTrainingTimePoint[];
  ratingDistribution: RatingDistribution[];
  categoryRatings: CategoryRatingData[];
  recentDors: RecentDOR[];
  filters: FieldTrainingFilters;
}

export interface PdsaCycleData extends PdsaCycleSummary {
  planDescription: string | null;
  planPrediction: string | null;
  planDataCollection: string | null;

  doObservations: string | null;
  doStartDate: string | null;
  doEndDate: string | null;

  studyResults: string | null;
  studyLearnings: string | null;
  studyDate: string | null;

  actDecision: string | null;
  actNextSteps: string | null;
  actDate: string | null;

  createdAt: string;
}
