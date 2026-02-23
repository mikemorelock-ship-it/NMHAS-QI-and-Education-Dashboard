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
  release: string; // e.g. "v2.1", "v2.0" — groups entries in collapsible sections
}

/** Metadata for a release group (title shown in collapsible header). */
export interface ReleaseInfo {
  version: string;
  label: string; // e.g. "February 2026 — Field Training & UI Polish"
  date: string; // representative date for sorting
}

/** All known releases, newest first. */
export const RELEASES: ReleaseInfo[] = [
  {
    version: "v2.4",
    label: "February 2026 Update 5 — Campaign Enhancements & Help Refresh",
    date: "2026-02-23",
  },
  {
    version: "v2.3",
    label: "February 2026 Update 4 — QI Coach, Campaign Reports & Resources",
    date: "2026-02-23",
  },
  {
    version: "v2.2",
    label: "February 2026 Update 3 — Audit & Version Control",
    date: "2026-02-18",
  },
  {
    version: "v2.1",
    label: "February 2026 Update 2 — Field Training & UI Polish",
    date: "2026-02-17",
  },
  {
    version: "v2.0",
    label: "February 2026 Update 1 — QI Campaigns & Platform Hardening",
    date: "2026-02-17",
  },
];

const CATEGORY_LABELS: Record<ChangelogEntry["category"], string> = {
  feature: "New Feature",
  improvement: "Improvement",
  fix: "Bug Fix",
};

const CATEGORY_COLORS: Record<ChangelogEntry["category"], string> = {
  feature: "#00b0ad", // nmh-teal
  improvement: "#fcb526", // amber
  fix: "#e04726", // nmh-orange/red
};

export { CATEGORY_LABELS, CATEGORY_COLORS };

// ---------------------------------------------------------------------------
// Entries — newest first
// ---------------------------------------------------------------------------

export const CHANGELOG: ChangelogEntry[] = [
  // --- v2.4 — Campaign Enhancements & Help Refresh -------------------------
  {
    date: "2026-02-23",
    title: "Campaign Sharing",
    description:
      "Generate shareable links for QI campaigns that can be sent to stakeholders outside the system. Share links provide read-only access to campaign reports without requiring login.",
    category: "feature",
    release: "v2.4",
  },
  {
    date: "2026-02-23",
    title: "Campaign Division & Department Scoping",
    description:
      "Campaigns can now be scoped to one or more divisions and departments using a multi-select picker. Scoping controls which metrics and data are included in campaign reports and KPI summaries.",
    category: "feature",
    release: "v2.4",
  },
  {
    date: "2026-02-23",
    title: "Campaign Metric Association",
    description:
      "Link campaigns directly to specific metric definitions. Associated metrics appear in the campaign report with trend charts and SPC analysis, making it easy to track improvement outcomes.",
    category: "feature",
    release: "v2.4",
  },
  {
    date: "2026-02-23",
    title: "Timeline Presets for Date Ranges",
    description:
      "Quick-select presets for Previous Week, Previous Month, Previous Quarter, and Previous Year make it easy to filter charts and reports to common time windows without manual date picking.",
    category: "feature",
    release: "v2.4",
  },
  {
    date: "2026-02-23",
    title: "Desired Direction for Metrics",
    description:
      "Metrics now have an optional desired direction (up or down) so trend arrows and chart colors correctly reflect whether movement is positive or negative. A downward trend in a 'lower is better' metric is now shown in green instead of red.",
    category: "feature",
    release: "v2.4",
  },
  {
    date: "2026-02-23",
    title: "Chart Legends & Smart Y-Axis",
    description:
      "Trending and control charts now display legends identifying each data series. Y-axis scaling automatically adapts to the data range, preventing charts from being squished by outliers or overly wide default ranges.",
    category: "improvement",
    release: "v2.4",
  },
  {
    date: "2026-02-23",
    title: "Key Findings in Campaign Reports",
    description:
      "Campaign reports now include a Key Findings section with best practice recommendations and an enhanced report structure for executive review.",
    category: "improvement",
    release: "v2.4",
  },
  {
    date: "2026-02-23",
    title: "IHI Shift & Trend Detection",
    description:
      "Charts now use adaptive IHI-standard thresholds for detecting special cause variation. Shifts (8+ consecutive points on one side of the center line) and trends (6+ consecutive increases or decreases) are automatically highlighted.",
    category: "improvement",
    release: "v2.4",
  },
  {
    date: "2026-02-23",
    title: "Comprehensive Help Refresh",
    description:
      "All help pages updated with documentation for every admin, public, and field training portal feature. Added entries for Campaigns, Action Items, Reports, Users, Team DORs, All Trainees, and Snapshots management. Updated glossary with new terms.",
    category: "improvement",
    release: "v2.4",
  },
  // --- v2.3 — QI Coach, Campaign Reports & Resources -----------------------
  {
    date: "2026-02-23",
    title: "AI-Powered QI Coach",
    description:
      "A new conversational QI Coach powered by Claude AI is available on campaign reports and metric detail pages. Ask freeform questions about QI best practices, PDSA methodology, SPC interpretation, and improvement strategies — all grounded in IHI Model for Improvement principles.",
    category: "feature",
    release: "v2.3",
  },
  {
    date: "2026-02-23",
    title: "QI Campaign Reports",
    description:
      "Campaign report pages now feature interactive control chart / trending toggle, executive summary with key metrics, Gantt timeline, driver diagram visualization, PDSA cycle summaries, and printable layout.",
    category: "feature",
    release: "v2.3",
  },
  {
    date: "2026-02-23",
    title: "QI & IHI Resources Hub",
    description:
      "The Resources page now houses curated documentation on quality improvement standards from IHI, NASEMSO, NHTSA, and other respected organizations. Includes quick-reference guides for PDSA cycles, driver diagrams, SPC charts, and the IHI Model for Improvement.",
    category: "feature",
    release: "v2.3",
  },
  {
    date: "2026-02-23",
    title: "PDSA Annotations on Charts",
    description:
      "Control charts in campaign reports now display numbered PDSA cycle annotations showing when change ideas were tested, making it easy to correlate improvements with specific interventions.",
    category: "improvement",
    release: "v2.3",
  },
  {
    date: "2026-02-23",
    title: "Help Documentation Updated",
    description:
      "Help pages updated with documentation for campaign reports, QI Coach, Resources hub, and all features added since v2.2. New glossary terms added for IHI, NASEMSO, and other QI concepts.",
    category: "improvement",
    release: "v2.3",
  },
  // --- v2.2 — Audit & Version Control --------------------------------------
  {
    date: "2026-02-18",
    title: "Audit Log Viewer",
    description:
      "New admin page to browse, filter, and search the full history of all actions taken in the system. Filter by action type, entity, actor, date range, or free-text search. Expandable rows show before/after change diffs.",
    category: "feature",
    release: "v2.2",
  },
  {
    date: "2026-02-18",
    title: "Structured Change Tracking",
    description:
      "Update and delete actions now record structured before/after diffs showing exactly which fields changed and their old vs. new values. Previously, audit logs only recorded a text description of the action.",
    category: "feature",
    release: "v2.2",
  },
  {
    date: "2026-02-18",
    title: "Entity History",
    description:
      "A reusable 'View History' button that can be placed on any record to show its complete change timeline — who changed it, when, and what was modified.",
    category: "feature",
    release: "v2.2",
  },
  {
    date: "2026-02-18",
    title: "Conventional Commits",
    description:
      "Git commit messages are now enforced to follow the Conventional Commits standard (feat:, fix:, docs:, etc.) via Commitlint hooks, making the project history easier to scan and understand.",
    category: "improvement",
    release: "v2.2",
  },
  {
    date: "2026-02-18",
    title: "Automated Code Quality",
    description:
      "Pre-commit hooks now automatically run Prettier formatting and ESLint checks on every commit via Husky and lint-staged, ensuring consistent code style across the codebase.",
    category: "improvement",
    release: "v2.2",
  },
  {
    date: "2026-02-18",
    title: "CI/CD Pipeline",
    description:
      "GitHub Actions workflow automatically runs formatting checks, linting, TypeScript type checking, tests, and a full production build on every pull request to catch issues before merging.",
    category: "improvement",
    release: "v2.2",
  },
  // --- v2.1 — Field Training & UI Polish -----------------------------------
  {
    date: "2026-02-17",
    title: "View DOR from Team DORs",
    description:
      "Supervisors, managers, and admins can now click through to the full read-only DOR directly from the Team DORs table. Draft DORs are also viewable for users with review permissions.",
    category: "feature",
    release: "v2.1",
  },
  {
    date: "2026-02-17",
    title: "Timestamped Supervisor Notes",
    description:
      "Supervisor notes on DORs are now a threaded conversation with timestamps and author tracking. Multiple supervisors can add notes, and each entry shows who wrote it and when for a complete audit trail.",
    category: "feature",
    release: "v2.1",
  },
  {
    date: "2026-02-17",
    title: "Admin Password Management",
    description:
      "Super admins can now view and reset passwords for any user directly from the Users page. Password resets enforce strength requirements and immediately invalidate existing sessions.",
    category: "feature",
    release: "v2.1",
  },
  {
    date: "2026-02-17",
    title: "PDSA Cycle Number Selector",
    description:
      "PDSA cycle numbers in the QI Workflow Wizard are now a dropdown selector (1-10) that auto-calculates the next cycle number, replacing the free-text input.",
    category: "improvement",
    release: "v2.1",
  },
  {
    date: "2026-02-17",
    title: "Responsive Layout Fixes",
    description:
      "Fixed layout compression on narrow screens across all admin pages, campaign cards, navigation bar, and page headers. Elements no longer squish or overlap when the browser is resized.",
    category: "fix",
    release: "v2.1",
  },
  {
    date: "2026-02-17",
    title: "Snapshot Dialog Overflow Fix",
    description:
      "The Snapshots Generated dialog now scrolls properly when results exceed the viewport height instead of overflowing its container.",
    category: "fix",
    release: "v2.1",
  },
  // --- v2.0 — QI Campaigns & Platform Hardening ----------------------------
  {
    date: "2026-02-17",
    title: "Campaign Gantt Chart",
    description:
      "View QI campaigns on an interactive Gantt timeline with Day, Week, Month, Year, and 3-Year zoom levels. Available on both the public QI page and admin campaigns page via the new Gantt tab.",
    category: "feature",
    release: "v2.0",
  },
  {
    date: "2026-02-17",
    title: "Campaign View Toggle",
    description:
      "Switch between Cards, List, and Gantt views on the QI Campaigns section of the public dashboard and admin campaigns page.",
    category: "feature",
    release: "v2.0",
  },
  {
    date: "2026-02-17",
    title: "QI Campaigns & Action Items",
    description:
      "Campaigns are now the primary organizing concept for Quality Improvement. Group driver diagrams and PDSA cycles under named initiatives with owner, timeline, and goals. Track corrective actions with priority, assignee, and due dates.",
    category: "feature",
    release: "v2.0",
  },
  {
    date: "2026-02-17",
    title: "QI Workflow Wizard",
    description:
      "Guided step-by-step workflow for building QI projects: define campaign, set aim, build driver diagram, identify change ideas, and plan PDSA cycles — all in one connected flow.",
    category: "feature",
    release: "v2.0",
  },
  {
    date: "2026-02-17",
    title: "Comprehensive Test Suite",
    description:
      "228 automated tests covering permissions, password validation, error handling, API responses, pagination, utilities, data aggregation, and SPC calculations. 95% code coverage on core libraries.",
    category: "improvement",
    release: "v2.0",
  },
  {
    date: "2026-02-17",
    title: "Error Boundaries",
    description:
      "Friendly error pages now catch rendering failures across all portals (admin, public, field training) with recovery options instead of blank screens.",
    category: "improvement",
    release: "v2.0",
  },
  {
    date: "2026-02-17",
    title: "Audit Logging",
    description:
      "All 101 mutation actions across the system now consistently log actor, action, entity, and details for accountability and troubleshooting.",
    category: "improvement",
    release: "v2.0",
  },
  {
    date: "2026-02-17",
    title: "N+1 Query Optimization",
    description:
      "Dashboard API routes rewritten to use bulk queries instead of per-item loops, significantly improving load times for departments with many metrics.",
    category: "improvement",
    release: "v2.0",
  },
  {
    date: "2026-02-17",
    title: "Pagination",
    description:
      "Data Entry and DOR lists now paginate at 50 records per page instead of loading all records at once, preventing slow loads as data grows.",
    category: "improvement",
    release: "v2.0",
  },
  {
    date: "2026-02-17",
    title: "Security Hardening",
    description:
      "20 security improvements including rate limiting, account lockout, CSRF protection, session management, idle timeout, JWT validation, HTTPS enforcement, and input sanitization.",
    category: "improvement",
    release: "v2.0",
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

/** Group changelog entries by release version. Returns array of [release, entries]. */
export function groupByRelease(): Array<{ release: ReleaseInfo; entries: ChangelogEntry[] }> {
  const groups: Record<string, ChangelogEntry[]> = {};
  for (const entry of CHANGELOG) {
    if (!groups[entry.release]) groups[entry.release] = [];
    groups[entry.release].push(entry);
  }
  return RELEASES.map((r) => ({
    release: r,
    entries: groups[r.version] || [],
  })).filter((g) => g.entries.length > 0);
}
