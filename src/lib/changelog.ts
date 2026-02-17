// ---------------------------------------------------------------------------
// Changelog — Single source of truth for system updates shown on Help page.
//
// Add new entries at the TOP of the CHANGELOG array (newest first).
// The sidebar badge auto-updates based on localStorage "last seen" date.
// ---------------------------------------------------------------------------

export interface ChangelogEntry {
  date: string; // ISO date "YYYY-MM-DD"
  title: string;
  description: string;
  category: "feature" | "improvement" | "fix";
}

const CATEGORY_LABELS: Record<ChangelogEntry["category"], string> = {
  feature: "New Feature",
  improvement: "Improvement",
  fix: "Bug Fix",
};

const CATEGORY_COLORS: Record<ChangelogEntry["category"], string> = {
  feature: "#00b0ad",   // nmh-teal
  improvement: "#fcb526", // amber
  fix: "#e04726",        // nmh-orange/red
};

export { CATEGORY_LABELS, CATEGORY_COLORS };

// ---------------------------------------------------------------------------
// Entries — newest first
// ---------------------------------------------------------------------------

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-02-17",
    title: "Campaign Gantt Chart",
    description:
      "View QI campaigns on an interactive Gantt timeline with Day, Week, Month, Year, and 3-Year zoom levels. Available on both the public QI page and admin campaigns page via the new Gantt tab.",
    category: "feature",
  },
  {
    date: "2026-02-17",
    title: "Campaign View Toggle",
    description:
      "Switch between Cards, List, and Gantt views on the QI Campaigns section of the public dashboard and admin campaigns page.",
    category: "feature",
  },
  {
    date: "2026-02-17",
    title: "QI Campaigns & Action Items",
    description:
      "Campaigns are now the primary organizing concept for Quality Improvement. Group driver diagrams and PDSA cycles under named initiatives with owner, timeline, and goals. Track corrective actions with priority, assignee, and due dates.",
    category: "feature",
  },
  {
    date: "2026-02-17",
    title: "QI Workflow Wizard",
    description:
      "Guided step-by-step workflow for building QI projects: define campaign, set aim, build driver diagram, identify change ideas, and plan PDSA cycles — all in one connected flow.",
    category: "feature",
  },
  {
    date: "2026-02-17",
    title: "Comprehensive Test Suite",
    description:
      "228 automated tests covering permissions, password validation, error handling, API responses, pagination, utilities, data aggregation, and SPC calculations. 95% code coverage on core libraries.",
    category: "improvement",
  },
  {
    date: "2026-02-17",
    title: "Error Boundaries",
    description:
      "Friendly error pages now catch rendering failures across all portals (admin, public, field training) with recovery options instead of blank screens.",
    category: "improvement",
  },
  {
    date: "2026-02-17",
    title: "Audit Logging",
    description:
      "All 101 mutation actions across the system now consistently log actor, action, entity, and details for accountability and troubleshooting.",
    category: "improvement",
  },
  {
    date: "2026-02-17",
    title: "N+1 Query Optimization",
    description:
      "Dashboard API routes rewritten to use bulk queries instead of per-item loops, significantly improving load times for departments with many metrics.",
    category: "improvement",
  },
  {
    date: "2026-02-17",
    title: "Pagination",
    description:
      "Data Entry and DOR lists now paginate at 50 records per page instead of loading all records at once, preventing slow loads as data grows.",
    category: "improvement",
  },
  {
    date: "2026-02-17",
    title: "Security Hardening",
    description:
      "20 security improvements including rate limiting, account lockout, CSRF protection, session management, idle timeout, JWT validation, HTTPS enforcement, and input sanitization.",
    category: "improvement",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** ISO date string of the most recent changelog entry */
export const LATEST_CHANGELOG_DATE: string =
  CHANGELOG.length > 0 ? CHANGELOG[0].date : "1970-01-01";

/** localStorage key for tracking when the user last viewed updates */
export const CHANGELOG_STORAGE_KEY = "ems-dashboard:changelog-last-seen";

/** Count entries newer than the given date string (null = never seen = all are new) */
export function getUnseenCount(lastSeenDate: string | null): number {
  if (!lastSeenDate) return CHANGELOG.length;
  return CHANGELOG.filter((entry) => entry.date > lastSeenDate).length;
}
