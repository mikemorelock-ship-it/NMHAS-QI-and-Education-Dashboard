export const NMH_COLORS = {
  teal: "#00b0ad",
  orange: "#e04726",
  yellow: "#fcb526",
  gray: "#4b4f54",
  darkTeal: "#00383d",
  darkRed: "#60151E",
  lightGray: "#D6D6D6",
  darkBrown: "#762d10",
  white: "#ffffff",
} as const;

export const CHART_COLORS = [
  NMH_COLORS.teal,
  NMH_COLORS.orange,
  NMH_COLORS.yellow,
  NMH_COLORS.gray,
  NMH_COLORS.darkTeal,
  NMH_COLORS.darkRed,
  NMH_COLORS.darkBrown,
];

export const UNIT_LABELS: Record<string, string> = {
  count: "",
  currency: "$",
  percentage: "%",
  duration: "min",
  score: "/10",
  rate: "rate",
};

export const PERIOD_TYPES = [
  "daily",
  "weekly",
  "bi-weekly",
  "monthly",
  "quarterly",
  "annual",
] as const;

export const DEPARTMENT_TYPES = ["quality", "clinical", "education", "operations"] as const;

export const CHART_TYPES = ["line", "bar", "area"] as const;

export const METRIC_UNITS = [
  "count",
  "currency",
  "percentage",
  "duration",
  "score",
  "rate",
] as const;

export const AGGREGATION_TYPES = ["sum", "average", "min", "max", "latest"] as const;

export const DESIRED_DIRECTIONS = ["up", "down"] as const;

export const DESIRED_DIRECTION_LABELS: Record<string, string> = {
  up: "Higher is Better",
  down: "Lower is Better",
};

/** Infer a sensible default desiredDirection from the metric unit */
export function defaultDesiredDirection(unit: string): "up" | "down" {
  if (unit === "duration") return "down";
  return "up";
}

export const AGGREGATION_TYPE_LABELS: Record<string, string> = {
  sum: "Sum",
  average: "Average",
  min: "Minimum",
  max: "Maximum",
  latest: "Latest",
};

/** Default aggregationType based on metric unit */
export function defaultAggregationType(unit: string): string {
  if (unit === "count" || unit === "currency") return "sum";
  return "average";
}

// ---------------------------------------------------------------------------
// SPC / Data Type Constants
// ---------------------------------------------------------------------------

export const DATA_TYPES = ["continuous", "proportion", "rate"] as const;

export const DATA_TYPE_LABELS: Record<string, string> = {
  continuous: "Continuous (I-MR chart)",
  proportion: "Proportion (P-chart)",
  rate: "Rate (U-chart)",
};

export const SPC_SIGMA_LEVELS = [1, 2, 3] as const;

export const SPC_SIGMA_LABELS: Record<number, string> = {
  1: "1σ (68%)",
  2: "2σ (95%)",
  3: "3σ (99.7%)",
};

/** Default dataType based on metric unit */
export function defaultDataType(unit: string): string {
  if (unit === "percentage") return "proportion";
  if (unit === "rate") return "rate";
  return "continuous";
}

export const ANNOTATION_TYPES = ["intervention", "milestone", "event"] as const;

export const RESOURCE_TYPES = ["document", "link", "reference", "protocol"] as const;

// ---------------------------------------------------------------------------
// Driver Diagram Constants
// ---------------------------------------------------------------------------

export const DRIVER_DIAGRAM_STATUSES = ["draft", "active", "archived"] as const;

export const DRIVER_DIAGRAM_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  active: "Active",
  archived: "Archived",
};

export const DRIVER_NODE_TYPES = ["aim", "primary", "secondary", "changeIdea"] as const;

export const DRIVER_NODE_TYPE_LABELS: Record<string, string> = {
  aim: "Aim",
  primary: "Primary Driver",
  secondary: "Secondary Driver",
  changeIdea: "Change Idea",
};

export const DRIVER_NODE_TYPE_COLORS: Record<string, string> = {
  aim: "#00b0ad",
  primary: "#e04726",
  secondary: "#fcb526",
  changeIdea: "#4b4f54",
};

// ---------------------------------------------------------------------------
// PDSA Cycle Constants
// ---------------------------------------------------------------------------

export const PDSA_STATUSES = [
  "planning",
  "doing",
  "studying",
  "acting",
  "completed",
  "abandoned",
] as const;

export const PDSA_STATUS_LABELS: Record<string, string> = {
  planning: "Plan",
  doing: "Do",
  studying: "Study",
  acting: "Act",
  completed: "Completed",
  abandoned: "Abandoned",
};

export const PDSA_STATUS_COLORS: Record<string, string> = {
  planning: "#00b0ad",
  doing: "#e04726",
  studying: "#fcb526",
  acting: "#4b4f54",
  completed: "#00383d",
  abandoned: "#60151E",
};

export const PDSA_OUTCOMES = ["adopt", "adapt", "abandon"] as const;

// ---------------------------------------------------------------------------
// Field Training Constants
// ---------------------------------------------------------------------------

export const FTO_ROLES = ["fto", "supervisor", "manager", "admin"] as const;

export const FTO_ROLE_LABELS: Record<string, string> = {
  fto: "FTO",
  supervisor: "Supervisor",
  manager: "Manager",
  admin: "Admin",
};

/** Roles that are permitted to sign off on training phases */
export const PHASE_SIGNOFF_ROLES = ["supervisor", "manager", "admin"] as const;

export const SKILL_STEP_MAX = 20;

export const DOR_STATUSES = ["draft", "submitted"] as const;

export const DOR_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
};

export const PDSA_OUTCOME_LABELS: Record<string, string> = {
  adopt: "Adopt",
  adapt: "Adapt",
  abandon: "Abandon",
};

// ---------------------------------------------------------------------------
// Campaign Constants
// ---------------------------------------------------------------------------

export const CAMPAIGN_STATUSES = ["planning", "active", "completed", "archived"] as const;

export const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  completed: "Completed",
  archived: "Archived",
};

export const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  planning: "#00b0ad",
  active: "#e04726",
  completed: "#00383d",
  archived: "#4b4f54",
};

// ---------------------------------------------------------------------------
// Action Item Constants
// ---------------------------------------------------------------------------

export const ACTION_ITEM_STATUSES = ["open", "in_progress", "completed", "overdue"] as const;

export const ACTION_ITEM_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  completed: "Completed",
  overdue: "Overdue",
};

export const ACTION_ITEM_STATUS_COLORS: Record<string, string> = {
  open: "#00b0ad",
  in_progress: "#fcb526",
  completed: "#00383d",
  overdue: "#e04726",
};

export const ACTION_ITEM_PRIORITIES = ["low", "medium", "high", "critical"] as const;

export const ACTION_ITEM_PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const ACTION_ITEM_PRIORITY_COLORS: Record<string, string> = {
  low: "#4b4f54",
  medium: "#fcb526",
  high: "#e04726",
  critical: "#60151E",
};
