// ---------------------------------------------------------------------------
// Help Registry — Single source of truth for all help page content.
//
// When you add a new feature or page to any portal, add a HelpFeature entry
// here with the relevant `portals` tags. The help pages will automatically
// pick it up — no other files need editing.
// ---------------------------------------------------------------------------

export type PortalId = "public" | "admin" | "fto" | "trainee" | "fieldtraining";

export interface HelpFeature {
  id: string;
  portals: PortalId[];
  title: string;
  icon: string; // lucide-react icon name
  description: string;
  path?: string; // link to the page (portal-relative, e.g. "/admin/metrics")
  tips?: string[];
}

export interface GlossaryTerm {
  term: string;
  definition: string;
  portals: PortalId[];
  relatedTerms?: string[];
}

// ---------------------------------------------------------------------------
// Portal metadata (used for page titles / descriptions)
// ---------------------------------------------------------------------------

export const PORTAL_META: Record<
  PortalId,
  { title: string; description: string }
> = {
  public: {
    title: "Dashboard Help & Guide",
    description:
      "Learn how to navigate the NMH EMS Operations Dashboard, explore metrics, scorecards, and quality improvement tools.",
  },
  admin: {
    title: "Admin Portal Help & Guide",
    description:
      "Reference guide for administering departments, metrics, scorecards, field training, and quality improvement programs.",
  },
  fto: {
    title: "FTO Portal Help & Guide",
    description:
      "How to create, edit, and manage Daily Observation Reports (DORs) for your assigned trainees.",
  },
  trainee: {
    title: "Trainee Portal Help & Guide",
    description:
      "How to view your DORs, acknowledge evaluations, track skills, and monitor your training progress.",
  },
  fieldtraining: {
    title: "Field Training Portal Help & Guide",
    description:
      "How to use the unified Field Training portal — create and manage DORs, view evaluations, track skills, and monitor training progress.",
  },
};

// ---------------------------------------------------------------------------
// Feature registry
// ---------------------------------------------------------------------------

export const HELP_FEATURES: HelpFeature[] = [
  // ---- Public Dashboard ----
  {
    id: "public-metrics",
    portals: ["public"],
    title: "Metrics Dashboard",
    icon: "LayoutDashboard",
    description:
      "The main dashboard displays real-time EMS operations metrics organized by division and department. View KPI cards with sparkline trends, metric trend charts, and drill down into specific departments or divisions.",
    path: "/",
    tips: [
      "Use the division selector tabs to filter metrics by a specific division.",
      "Toggle between Card and List views using the view toggle in the top-right.",
      "Click any metric card to see detailed trend data, control charts, and historical values.",
      "The dashboard auto-refreshes every 60 seconds to show the latest data.",
    ],
  },
  {
    id: "public-scorecards",
    portals: ["public"],
    title: "Scorecards",
    icon: "ClipboardList",
    description:
      "Monthly performance scorecards showing how EMS operations are tracking against targets. Filter by year, division, department, and individual metrics.",
    path: "/scorecards",
    tips: [
      "Use the year selector to compare performance across different years.",
      "Multi-select filters let you view specific divisions or departments side by side.",
      "Toggle 'KPI Only' to focus on the most important metrics.",
      "Use Quick Filter presets to quickly switch between common filter combinations.",
    ],
  },
  {
    id: "public-qi",
    portals: ["public"],
    title: "Quality Improvement Tools",
    icon: "GitBranchPlus",
    description:
      "The QI hub shows active driver diagrams and PDSA (Plan-Do-Study-Act) cycles. Driver diagrams visualize improvement strategies from aims to change ideas. PDSA cycles track the progress of specific improvement experiments.",
    path: "/quality-improvement",
    tips: [
      "Click on a driver diagram to see its full tree structure from Aim through Change Ideas.",
      "Change Ideas with linked PDSA cycles show a badge — click them to see cycle details.",
      "Use tabs to toggle between cycles when a Change Idea has multiple PDSA experiments.",
    ],
  },
  {
    id: "public-driver-diagrams",
    portals: ["public"],
    title: "Driver Diagrams",
    icon: "GitBranchPlus",
    description:
      "Each driver diagram shows a hierarchical tree: Aim → Primary Drivers → Secondary Drivers → Change Ideas. They help visualize the theory of change behind quality improvement initiatives.",
    path: "/quality-improvement",
    tips: [
      "The color-coded legend explains each node type (Aim, Primary, Secondary, Change Idea).",
      "Collapse or expand tree branches by clicking the chevron icons.",
      "PDSA badges on Change Ideas indicate how many improvement cycles are linked.",
    ],
  },
  {
    id: "public-pdsa",
    portals: ["public"],
    title: "PDSA Cycles",
    icon: "RefreshCcw",
    description:
      "View all active and completed PDSA (Plan-Do-Study-Act) cycles. Each cycle represents a structured improvement experiment with four phases: Plan the change, Do the test, Study the results, and Act on what was learned.",
    path: "/quality-improvement/pdsa",
    tips: [
      "Status badges show which phase each cycle is currently in.",
      "Completed cycles display their outcome: Adopt, Adapt, or Abandon.",
    ],
  },
  {
    id: "public-field-training",
    portals: ["public"],
    title: "Field Training Dashboard",
    icon: "GraduationCap",
    description:
      "Analytics dashboard for the Field Training & Evaluation Program (FTEP). View DOR statistics, average ratings over time, rating distributions, and category-level performance for all trainees.",
    path: "/field-training",
    tips: [
      "Filter by Division, FTO, Trainee, or Phase to narrow the view.",
      "The reference line at 4 on charts indicates the 'Acceptable' performance threshold.",
      "Rating distribution charts show how evaluations spread across the 1–7 scale.",
      "The Recent DORs table at the bottom shows individual evaluations with flags.",
    ],
  },

  // ---- Admin Portal ----
  {
    id: "admin-overview",
    portals: ["admin"],
    title: "Admin Overview",
    icon: "LayoutDashboard",
    description:
      "The admin dashboard shows summary statistics (departments, metrics, data entries, etc.), recent data entries, and the audit log of all administrative actions.",
    path: "/admin",
    tips: [
      "The audit log shows who did what and when — useful for tracking changes.",
      "Stat cards link directly to their respective management pages.",
    ],
  },
  {
    id: "admin-departments",
    portals: ["admin"],
    title: "Divisions & Departments",
    icon: "Building2",
    description:
      "Manage the organizational structure: create, edit, and organize divisions and departments. Each department has a type (Quality, Clinical, Operations, Education) and can contain multiple metrics.",
    path: "/admin/departments",
    tips: [
      "Departments are color-coded by type for quick visual identification.",
      "Deleting a department will cascade-delete its associated metrics and data.",
    ],
  },
  {
    id: "admin-metrics",
    portals: ["admin"],
    title: "Metrics",
    icon: "BarChart3",
    description:
      "Define and configure metric definitions including name, unit, period type, aggregation method, targets, and control limits. Metrics are linked to departments and appear on the dashboard.",
    path: "/admin/metrics",
    tips: [
      "Set upper and lower control limits for SPC (Statistical Process Control) charting.",
      "The 'KPI' flag determines whether a metric appears in scorecard KPI views.",
      "Use rate-type metrics for numerator/denominator calculations.",
    ],
  },
  {
    id: "admin-scorecards",
    portals: ["admin"],
    title: "Scorecards",
    icon: "ClipboardList",
    description:
      "Configure which metrics appear on scorecards and manage scorecard display settings. Scorecards provide a monthly summary view of performance against targets.",
    path: "/admin/scorecards",
    tips: [
      "Preset metric configurations let you quickly set up standard scorecard layouts.",
    ],
  },
  {
    id: "admin-qi-workflow",
    portals: ["admin"],
    title: "QI Workflow",
    icon: "Wand2",
    description:
      "The unified quality improvement workflow hub with three modes. Guided (Campaign Wizard) walks you through the IHI Model for Improvement step by step. Flexible (Connected Canvas) shows campaign completeness and orphaned items. Quick Capture lets you create standalone entities with optional linking.",
    path: "/admin/qi-workflow",
    tips: [
      "Use the Guided wizard for new improvement projects — it includes IHI coaching at each step.",
      "The Flexible Canvas shows completeness scores for each campaign and highlights unlinked diagrams and PDSA cycles.",
      "Quick Capture is best for rapid ad-hoc PDSA cycles or standalone driver diagrams.",
      "All three modes use the same underlying data — entities created in one mode are visible in all others.",
    ],
  },
  {
    id: "admin-driver-diagrams",
    portals: ["admin"],
    title: "Driver Diagrams",
    icon: "GitBranchPlus",
    description:
      "Create and manage driver diagrams for quality improvement initiatives. Build tree structures with Aim, Primary Drivers, Secondary Drivers, and Change Ideas. Link PDSA cycles to Change Ideas.",
    path: "/admin/driver-diagrams",
    tips: [
      "Use the tree editor to add, reorder, and nest nodes.",
      "Each diagram can be linked to a metric definition for tracking.",
      "The slug field determines the public URL of the diagram.",
    ],
  },
  {
    id: "admin-pdsa",
    portals: ["admin"],
    title: "PDSA Cycles",
    icon: "RefreshCcw",
    description:
      "Manage Plan-Do-Study-Act cycles. Create new cycles linked to Change Ideas, update phase details (Plan, Do, Study, Act), and record outcomes (Adopt, Adapt, Abandon).",
    path: "/admin/pdsa-cycles",
    tips: [
      "Each cycle is linked to a Change Idea node in a driver diagram.",
      "Update the status as the cycle progresses through phases.",
      "Record the outcome when the Study phase is complete.",
    ],
  },
  {
    id: "admin-field-training",
    portals: ["admin"],
    title: "Field Training Program",
    icon: "GraduationCap",
    description:
      "Administer the FTEP field training program. Manage trainees, FTOs (Field Training Officers), DORs (Daily Observation Reports), skill categories, training phases, and program settings.",
    path: "/admin/field-training",
    tips: [
      "The overview page shows active trainees, recent DORs, and key statistics.",
      "Use sub-pages to manage Trainees, FTOs, DORs, Skills, and Settings individually.",
    ],
  },
  {
    id: "admin-ft-trainees",
    portals: ["admin"],
    title: "Manage Trainees",
    icon: "Users",
    description:
      "Add, edit, and manage trainee records. View individual trainee profiles with phase progress, DOR history, skill signoffs, and performance trends.",
    path: "/admin/field-training/trainees",
    tips: [
      "Click a trainee to see their full profile with phase timeline and DOR history.",
      "Assign trainees to training phases and track completion.",
    ],
  },
  {
    id: "admin-ft-ftos",
    portals: ["admin"],
    title: "Manage FTOs",
    icon: "UserCog",
    description:
      "Add and manage Field Training Officers. Assign roles (FTO, Supervisor, Manager, Admin) that determine permissions like phase signoff authority.",
    path: "/admin/field-training/ftos",
    tips: [
      "Only Supervisors, Managers, and Admins can sign off on phase completions.",
      "FTOs are assigned to trainees through Training Assignments.",
    ],
  },
  {
    id: "admin-ft-dors",
    portals: ["admin"],
    title: "Manage DORs",
    icon: "FileText",
    description:
      "View and create Daily Observation Reports from the admin portal. DORs capture trainee performance across evaluation categories with a 1–7 rating scale.",
    path: "/admin/field-training/dors",
    tips: [
      "Create new DORs by clicking 'New DOR' and selecting the trainee and FTO.",
      "The DOR list can be filtered by date, trainee, FTO, and status.",
    ],
  },
  {
    id: "admin-ft-skills",
    portals: ["admin"],
    title: "Manage Skills",
    icon: "ClipboardCheck",
    description:
      "Define skill categories and individual skills that trainees must complete. Mark skills as critical to highlight mandatory competencies. Add step-by-step procedures to each skill.",
    path: "/admin/field-training/skills",
    tips: [
      "Critical skills are flagged with a special indicator on the trainee portal.",
      "Skills can include required and optional steps for detailed tracking.",
    ],
  },
  {
    id: "admin-ft-settings",
    portals: ["admin"],
    title: "Training Settings",
    icon: "Settings",
    description:
      "Configure training phases, evaluation categories, and program settings. Phases define the structured progression of the training program (e.g., Phase 1, Phase 2).",
    path: "/admin/field-training/settings",
    tips: [
      "Evaluation categories determine which performance areas are rated on each DOR.",
      "The 14 default categories are aligned with FTEP standards.",
    ],
  },
  {
    id: "admin-data-entry",
    portals: ["admin"],
    title: "Data Entry",
    icon: "PenLine",
    description:
      "Manually enter metric values for specific divisions and departments. Select the metric, period, and enter the value. Useful for metrics that aren't automatically imported.",
    path: "/admin/data-entry",
    tips: [
      "Select the division and department first to see available metrics.",
      "The date picker defaults to the current period.",
    ],
  },
  {
    id: "admin-upload",
    portals: ["admin"],
    title: "Upload Data",
    icon: "FileUp",
    description:
      "Bulk upload metric data via CSV or spreadsheet files. Map columns from your file to the expected fields (metric, date, value, division, department).",
    path: "/admin/upload",
    tips: [
      "Use the column mapping interface to match your file's headers to the expected fields.",
      "Preview the data before confirming the import.",
      "Invalid rows are highlighted so you can fix them before importing.",
    ],
  },
  {
    id: "admin-resources",
    portals: ["admin"],
    title: "Resources",
    icon: "FolderOpen",
    description:
      "A hub for training materials, protocol documents, reference links, and other resources. (Coming soon — this feature is under development.)",
    path: "/admin/resources",
  },

  // ---- Field Training Portal (FTO features) ----
  {
    id: "fto-dashboard",
    portals: ["fieldtraining"],
    title: "FTO Dashboard",
    icon: "LayoutDashboard",
    description:
      "Your home page showing assigned trainees, recent DORs you've submitted, and a count of draft DORs waiting to be completed.",
    path: "/fieldtraining",
    tips: [
      "Draft DORs are highlighted so you can finish them before they go stale.",
      "Click on a trainee to quickly start a new DOR for them.",
    ],
  },
  {
    id: "fto-create-dor",
    portals: ["fieldtraining"],
    title: "Creating a DOR",
    icon: "FilePlus",
    description:
      "Create a new Daily Observation Report for one of your assigned trainees. Select the trainee, date, and training phase, then rate their performance in each evaluation category on a 1–7 scale.",
    path: "/fieldtraining/dors/new",
    tips: [
      "The trainee selector only shows trainees currently assigned to you.",
      "Rate each category from 1 (Not Acceptable) to 7 (Superior). A rating of 4 is 'Acceptable.'",
      "Add narrative comments to provide context for your ratings.",
      "Use the 'Most Satisfactory' and 'Least Satisfactory' fields to highlight key observations.",
      "Set a recommendation action: Continue, Advance, Extend, Remediate, NRT, Release, or Terminate.",
    ],
  },
  {
    id: "fto-draft-dors",
    portals: ["fieldtraining"],
    title: "Draft DORs",
    icon: "FileEdit",
    description:
      "Save a DOR as a draft to return to it later. Drafts are only visible to you and can be edited until you submit them. Once submitted, a DOR becomes read-only and is sent to the trainee for acknowledgment.",
    path: "/fieldtraining/dors",
    tips: [
      "Use the 'Drafts' filter tab to quickly find your unfinished DORs.",
      "Edit a draft by clicking the edit icon in the DOR list.",
      "Submitting a draft locks it and sends it to the trainee.",
    ],
  },
  {
    id: "fto-rating-scale",
    portals: ["fieldtraining"],
    title: "DOR Rating Scale (1–7)",
    icon: "Star",
    description:
      "Each evaluation category is rated on a 1–7 scale aligned with FTEP standards. The scale is: 1 = Not Acceptable, 2 = Below Standard, 3 = Needs Improvement, 4 = Acceptable (meets expectations), 5 = Above Average, 6 = Exceeds Expectations, 7 = Superior. Ratings are color-coded: red (1–2), orange (3), gray (4), green (5–7).",
    tips: [
      "A rating of 4 is the baseline — the trainee is meeting expectations for their current phase.",
      "Ratings below 4 should include narrative comments explaining specific deficiencies.",
      "Ratings of 6 or 7 indicate exceptional performance worth noting.",
    ],
  },
  {
    id: "fto-recommendations",
    portals: ["fieldtraining"],
    title: "Recommendation Actions",
    icon: "MessageSquare",
    description:
      "Each DOR includes a recommendation for the trainee's training path: Continue (keep current pace), Advance (ready for next phase), Extend (needs more time in current phase), Remediate (structured remediation plan), NRT (Not Responding to Training — escalation flag), Release (cleared for independent duty), or Terminate (end training).",
    tips: [
      "NRT and REM flags trigger special alerts visible to supervisors and program administrators.",
      "Use 'Advance' when a trainee consistently meets or exceeds expectations for their phase.",
    ],
  },
  {
    id: "fto-tracking",
    portals: ["fieldtraining"],
    title: "Tracking DORs",
    icon: "FileText",
    description:
      "View all your submitted DORs in the 'My DORs' page. Filter between All, Drafts, and Submitted. See whether the trainee has acknowledged each DOR.",
    path: "/fieldtraining/dors",
    tips: [
      "An acknowledgment badge shows whether the trainee has reviewed the DOR.",
      "Click on any submitted DOR to see the full evaluation details.",
    ],
  },

  // ---- Field Training Portal (Trainee features) ----
  {
    id: "trainee-dashboard",
    portals: ["fieldtraining"],
    title: "Trainee Dashboard",
    icon: "LayoutDashboard",
    description:
      "Your home page showing total DORs received, skills completed, pending acknowledgments, and your training phase progress.",
    path: "/fieldtraining",
    tips: [
      "An alert card appears when you have DORs waiting to be acknowledged.",
      "Phase progress bars show how far along you are in each training phase.",
    ],
  },
  {
    id: "trainee-view-dors",
    portals: ["fieldtraining"],
    title: "Viewing DORs",
    icon: "FileText",
    description:
      "View all Daily Observation Reports submitted by your FTO. See your ratings, narrative feedback, recommendation actions, and any NRT/REM flags. Only submitted DORs are visible — drafts remain private to the FTO.",
    path: "/fieldtraining/dors",
    tips: [
      "Use the filter tabs to switch between All, Pending Acknowledgment, and Acknowledged.",
      "Click on any DOR to see the full detail view with category-level ratings.",
    ],
  },
  {
    id: "trainee-acknowledge",
    portals: ["fieldtraining"],
    title: "Acknowledging DORs",
    icon: "CheckCircle",
    description:
      "After reviewing a DOR, you must acknowledge it to confirm you've read the feedback. Check the confirmation box and click 'Acknowledge DOR.' This does not mean you agree — it means you have reviewed the evaluation.",
    path: "/fieldtraining/dors",
    tips: [
      "Acknowledgment is mandatory — your FTO and supervisors can see which DORs are pending.",
      "Once acknowledged, the DOR is marked with a timestamp showing when you reviewed it.",
      "You cannot un-acknowledge a DOR once confirmed.",
    ],
  },
  {
    id: "trainee-skills",
    portals: ["fieldtraining"],
    title: "Skills Checklist",
    icon: "ClipboardCheck",
    description:
      "Track your progress through the required skill competencies. Skills are organized by category and show which have been signed off by an FTO. Critical skills are highlighted. Each skill can include detailed steps (required and optional).",
    path: "/fieldtraining/skills",
    tips: [
      "Critical skills are flagged with a special indicator — these are mandatory for phase advancement.",
      "The progress bar shows your overall completion percentage.",
      "Expand a skill to see its step-by-step procedure and signoff details.",
    ],
  },
  {
    id: "trainee-phases",
    portals: ["fieldtraining"],
    title: "Phase Progress",
    icon: "TrendingUp",
    description:
      "Your dashboard shows the status of each training phase: Not Started, In Progress, or Completed. Phases represent the structured progression of your field training program, from initial orientation through independent duty clearance.",
    tips: [
      "Phase advancement is determined by your FTO's recommendations and supervisor signoff.",
      "Completing all skills and achieving consistent 'Acceptable' (4+) ratings supports advancement.",
    ],
  },
];

// ---------------------------------------------------------------------------
// Glossary
// ---------------------------------------------------------------------------

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    term: "DOR",
    definition:
      "Daily Observation Report — a structured evaluation completed by an FTO after each shift with a trainee. Captures performance ratings across evaluation categories on a 1–7 scale, narrative feedback, and a recommendation action.",
    portals: ["public", "admin", "fieldtraining"],
    relatedTerms: ["FTO", "FTEP", "Rating Scale"],
  },
  {
    term: "FTO",
    definition:
      "Field Training Officer — an experienced EMS provider who supervises, evaluates, and mentors new personnel during their field training period.",
    portals: ["public", "admin", "fieldtraining"],
    relatedTerms: ["DOR", "FTEP"],
  },
  {
    term: "FTEP",
    definition:
      "Field Training & Evaluation Program — the structured program through which new EMS personnel are trained, evaluated, and cleared for independent duty.",
    portals: ["public", "admin", "fieldtraining"],
    relatedTerms: ["FTO", "DOR", "Training Phase"],
  },
  {
    term: "NRT",
    definition:
      "Not Responding to Training — a flag set on a DOR when a trainee is not demonstrating improvement despite feedback and instruction. Triggers escalation to supervisors.",
    portals: ["admin", "fieldtraining"],
    relatedTerms: ["DOR", "REM"],
  },
  {
    term: "REM",
    definition:
      "Remedial Training — a flag indicating that a trainee has been placed on a structured remediation plan to address specific performance deficiencies.",
    portals: ["admin", "fieldtraining"],
    relatedTerms: ["NRT", "DOR"],
  },
  {
    term: "PDSA",
    definition:
      "Plan-Do-Study-Act — a four-phase improvement cycle used in quality improvement. Plan the change, Do a small-scale test, Study the results, and Act on what was learned (adopt, adapt, or abandon).",
    portals: ["public", "admin"],
    relatedTerms: ["QI", "Driver Diagram", "Change Idea"],
  },
  {
    term: "QI",
    definition:
      "Quality Improvement — systematic efforts to improve healthcare delivery processes and outcomes using data-driven methods like PDSA cycles and driver diagrams.",
    portals: ["public", "admin"],
    relatedTerms: ["PDSA", "Driver Diagram", "KPI", "IHI Model for Improvement"],
  },
  {
    term: "IHI Model for Improvement",
    definition:
      "A framework developed by the Institute for Healthcare Improvement built around three questions: What are we trying to accomplish? (Aim), How will we know that a change is an improvement? (Measures), What changes can we make that will result in improvement? (Change Ideas + PDSA Cycles). The QI Workflow wizard follows this model.",
    portals: ["admin"],
    relatedTerms: ["QI", "PDSA", "Campaign"],
  },
  {
    term: "Campaign Completeness",
    definition:
      "A percentage score (0-100%) shown on the QI Workflow Connected Canvas. Measures how many of five key elements a campaign has: Aim/Goals, Measures, Driver Diagram, PDSA Cycles, and Action Items. Helps identify which campaigns need further development.",
    portals: ["admin"],
    relatedTerms: ["QI", "Campaign"],
  },
  {
    term: "Campaign",
    definition:
      "A top-level improvement initiative that groups related driver diagrams, PDSA cycles, and action items. Campaigns have a status (Planning, Active, Completed, Archived) and an optional owner.",
    portals: ["admin"],
    relatedTerms: ["QI", "Driver Diagram", "PDSA", "Action Item"],
  },
  {
    term: "KPI",
    definition:
      "Key Performance Indicator — a critical metric that measures how effectively the organization is achieving its operational objectives. KPIs are highlighted on dashboards and scorecards.",
    portals: ["public", "admin"],
    relatedTerms: ["Metric", "Scorecard"],
  },
  {
    term: "SPC",
    definition:
      "Statistical Process Control — a method of quality control using statistical methods to monitor and control processes. SPC charts show data with upper and lower control limits.",
    portals: ["public", "admin"],
    relatedTerms: ["KPI", "Metric"],
  },
  {
    term: "Rating Scale (1–7)",
    definition:
      "The FTEP evaluation scale: 1 = Not Acceptable, 2 = Below Standard, 3 = Needs Improvement, 4 = Acceptable (meets expectations), 5 = Above Average, 6 = Exceeds Expectations, 7 = Superior. Ratings are color-coded from red (1) through gray (4) to green (7).",
    portals: ["admin", "fieldtraining"],
    relatedTerms: ["DOR", "FTEP"],
  },
  {
    term: "Recommendation Action",
    definition:
      "A required field on each DOR indicating the FTO's recommendation for the trainee: Continue (maintain current pace), Advance (ready for next phase), Extend (needs more time), Remediate (formal remediation), NRT (not responding to training), Release (cleared for independent duty), or Terminate (end training).",
    portals: ["admin", "fieldtraining"],
    relatedTerms: ["DOR", "NRT", "Training Phase"],
  },
  {
    term: "Driver Diagram",
    definition:
      "A visual tool showing the theory of change behind an improvement initiative. Structured as a tree: Aim → Primary Drivers → Secondary Drivers → Change Ideas.",
    portals: ["public", "admin"],
    relatedTerms: ["PDSA", "Change Idea", "Aim"],
  },
  {
    term: "Change Idea",
    definition:
      "A specific, actionable intervention at the leaf level of a driver diagram. Change Ideas are tested through PDSA cycles to determine their effectiveness.",
    portals: ["public", "admin"],
    relatedTerms: ["Driver Diagram", "PDSA"],
  },
  {
    term: "Aim",
    definition:
      "The overarching goal at the top of a driver diagram. Defines what the improvement initiative is trying to achieve, often with a measurable target.",
    portals: ["public", "admin"],
    relatedTerms: ["Driver Diagram", "Primary Driver"],
  },
  {
    term: "Primary Driver",
    definition:
      "A high-level factor that directly contributes to achieving the aim in a driver diagram. Primary drivers break the aim into major areas of focus.",
    portals: ["public", "admin"],
    relatedTerms: ["Driver Diagram", "Secondary Driver", "Aim"],
  },
  {
    term: "Secondary Driver",
    definition:
      "A more specific factor under a Primary Driver in a driver diagram. Secondary drivers connect to Change Ideas that can be tested.",
    portals: ["public", "admin"],
    relatedTerms: ["Driver Diagram", "Primary Driver", "Change Idea"],
  },
  {
    term: "Training Phase",
    definition:
      "A structured period in the FTEP program (e.g., Phase 1, Phase 2). Each phase has specific learning objectives and performance expectations. Trainees advance through phases based on FTO recommendations and supervisor signoff.",
    portals: ["admin", "fieldtraining"],
    relatedTerms: ["FTEP", "DOR", "Recommendation Action"],
  },
  {
    term: "Metric",
    definition:
      "A quantifiable measure tracked over time on the dashboard. Metrics have a unit (count, percentage, rate, etc.), period type (daily, monthly, etc.), and optional targets and control limits.",
    portals: ["public", "admin"],
    relatedTerms: ["KPI", "SPC", "Scorecard"],
  },
  {
    term: "Scorecard",
    definition:
      "A monthly summary view showing how multiple metrics are performing against their targets. Scorecards can be filtered by division, department, and year.",
    portals: ["public", "admin"],
    relatedTerms: ["Metric", "KPI"],
  },
  {
    term: "Skill Signoff",
    definition:
      "Confirmation by an FTO that a trainee has demonstrated competency in a specific skill. Once signed off, the skill shows the FTO's name and date of completion.",
    portals: ["admin", "fieldtraining"],
    relatedTerms: ["FTEP", "Training Phase"],
  },
];

// ---------------------------------------------------------------------------
// Filter helpers
// ---------------------------------------------------------------------------

export function getFeaturesForPortal(portal: PortalId): HelpFeature[] {
  return HELP_FEATURES.filter((f) => f.portals.includes(portal));
}

export function getGlossaryForPortal(portal: PortalId): GlossaryTerm[] {
  return GLOSSARY_TERMS.filter((t) => t.portals.includes(portal));
}
