// ---------------------------------------------------------------------------
// AI Focus Areas Engine — pure rule-based analysis, no database access
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FocusArea {
  type:
    | "weak_category"
    | "declining_trend"
    | "incomplete_coaching"
    | "critical_skill"
    | "recurring_pattern";
  title: string;
  detail: string;
  severity: "high" | "medium" | "low";
}

export interface TraineeAnalysisInput {
  recentDors: Array<{
    date: string;
    overallRating: number;
    recommendAction: string;
    ratings: Array<{
      categoryName: string;
      categoryId: string;
      rating: number;
    }>;
  }>;
  incompleteCoaching: Array<{
    activityTitle: string;
    status: string;
  }>;
  unsignedCriticalSkills: Array<{
    skillName: string;
  }>;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: Record<FocusArea["severity"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const MAX_FOCUS_AREAS = 5;

/**
 * Compute the arithmetic mean of an array of numbers.
 * Returns 0 for empty arrays.
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Round a number to one decimal place for display.
 */
function round1(n: number): string {
  return n.toFixed(1);
}

// ---------------------------------------------------------------------------
// Rule implementations
// ---------------------------------------------------------------------------

/**
 * Rule 1 — Weak categories
 *
 * Average each category's rating across all DORs. Categories with an
 * average rating <= 3.5 are flagged.
 *
 * Severity: high if avg <= 2.5, medium otherwise.
 */
function findWeakCategories(dors: TraineeAnalysisInput["recentDors"]): FocusArea[] {
  if (dors.length === 0) return [];

  // Gather ratings per category
  const categoryRatings = new Map<string, { name: string; ratings: number[] }>();

  for (const dor of dors) {
    for (const r of dor.ratings) {
      const entry = categoryRatings.get(r.categoryId);
      if (entry) {
        entry.ratings.push(r.rating);
      } else {
        categoryRatings.set(r.categoryId, {
          name: r.categoryName,
          ratings: [r.rating],
        });
      }
    }
  }

  const results: FocusArea[] = [];

  for (const [, entry] of categoryRatings) {
    const avg = mean(entry.ratings);
    if (avg <= 3.5) {
      results.push({
        type: "weak_category",
        title: `Needs attention: ${entry.name}`,
        detail: `Average rating ${round1(avg)}/7 across ${entry.ratings.length} DOR${entry.ratings.length === 1 ? "" : "s"}.`,
        severity: avg <= 2.5 ? "high" : "medium",
      });
    }
  }

  return results;
}

/**
 * Rule 2 — Declining trends
 *
 * Split DORs into a recent half and an earlier half (by chronological order).
 * For each category, if the recent half average dropped >= 0.5 from the
 * earlier half, flag a declining trend.
 *
 * Severity: high if dropped >= 1.0, medium otherwise.
 * Requires at least 4 DORs (2 per half) to detect trends.
 */
function findDecliningTrends(dors: TraineeAnalysisInput["recentDors"]): FocusArea[] {
  if (dors.length < 4) return [];

  // Sort chronologically (oldest first) for splitting
  const sorted = [...dors].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const midpoint = Math.floor(sorted.length / 2);
  const earlierHalf = sorted.slice(0, midpoint);
  const recentHalf = sorted.slice(midpoint);

  // Collect ratings per category in each half
  function collectCategoryAverages(
    subset: typeof sorted
  ): Map<string, { name: string; avg: number }> {
    const map = new Map<string, { name: string; ratings: number[] }>();
    for (const dor of subset) {
      for (const r of dor.ratings) {
        const entry = map.get(r.categoryId);
        if (entry) {
          entry.ratings.push(r.rating);
        } else {
          map.set(r.categoryId, { name: r.categoryName, ratings: [r.rating] });
        }
      }
    }

    const averages = new Map<string, { name: string; avg: number }>();
    for (const [id, entry] of map) {
      averages.set(id, { name: entry.name, avg: mean(entry.ratings) });
    }
    return averages;
  }

  const earlierAvgs = collectCategoryAverages(earlierHalf);
  const recentAvgs = collectCategoryAverages(recentHalf);

  const results: FocusArea[] = [];

  for (const [categoryId, recent] of recentAvgs) {
    const earlier = earlierAvgs.get(categoryId);
    if (!earlier) continue;

    const drop = earlier.avg - recent.avg;
    if (drop >= 0.5) {
      results.push({
        type: "declining_trend",
        title: `Declining: ${recent.name}`,
        detail: `Average dropped from ${round1(earlier.avg)} to ${round1(recent.avg)} (${round1(drop)} decline).`,
        severity: drop >= 1.0 ? "high" : "medium",
      });
    }
  }

  return results;
}

/**
 * Rule 3 — Incomplete coaching activities
 *
 * Each incomplete coaching assignment generates a focus area.
 * Severity: medium.
 */
function findIncompleteCoaching(coaching: TraineeAnalysisInput["incompleteCoaching"]): FocusArea[] {
  return coaching.map((c) => ({
    type: "incomplete_coaching" as const,
    title: `Complete coaching: ${c.activityTitle}`,
    detail: `Status: ${c.status.replace("_", " ")}.`,
    severity: "medium" as const,
  }));
}

/**
 * Rule 4 — Unsigned critical skills
 *
 * Each critical skill that the trainee has not been signed off on generates
 * a focus area.
 * Severity: high.
 */
function findUnsignedCriticalSkills(
  skills: TraineeAnalysisInput["unsignedCriticalSkills"]
): FocusArea[] {
  return skills.map((s) => ({
    type: "critical_skill" as const,
    title: `Critical skill needed: ${s.skillName}`,
    detail: `This critical skill has not been signed off yet.`,
    severity: "high" as const,
  }));
}

/**
 * Rule 5 — Recurring patterns
 *
 * If the last 3+ consecutive DORs (most recent first) have "remediate" or
 * "extend" as the recommended action, flag a recurring pattern.
 * Severity: high.
 */
function findRecurringPatterns(dors: TraineeAnalysisInput["recentDors"]): FocusArea[] {
  if (dors.length < 3) return [];

  // Sort most recent first
  const sorted = [...dors].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const flagActions = new Set(["remediate", "extend"]);

  // Count consecutive flagged actions from most recent
  let consecutiveCount = 0;
  let action = "";

  for (const dor of sorted) {
    if (flagActions.has(dor.recommendAction)) {
      consecutiveCount++;
      if (consecutiveCount === 1) {
        action = dor.recommendAction;
      }
    } else {
      break;
    }
  }

  if (consecutiveCount >= 3) {
    return [
      {
        type: "recurring_pattern",
        title: `Pattern: consecutive ${action} recommendations`,
        detail: `Last ${consecutiveCount} DORs have "${action}" as the recommended action.`,
        severity: "high",
      },
    ];
  }

  return [];
}

// ---------------------------------------------------------------------------
// Main analysis function
// ---------------------------------------------------------------------------

/**
 * Analyze a trainee's data and return up to 5 focus areas, sorted by severity
 * (high first, then medium, then low).
 *
 * This is a pure function with no side effects or database access.
 */
export function analyzeFocusAreas(input: TraineeAnalysisInput): FocusArea[] {
  const allAreas: FocusArea[] = [
    ...findWeakCategories(input.recentDors),
    ...findDecliningTrends(input.recentDors),
    ...findIncompleteCoaching(input.incompleteCoaching),
    ...findUnsignedCriticalSkills(input.unsignedCriticalSkills),
    ...findRecurringPatterns(input.recentDors),
  ];

  // Sort by severity: high → medium → low
  allAreas.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  // Return at most 5
  return allAreas.slice(0, MAX_FOCUS_AREAS);
}
