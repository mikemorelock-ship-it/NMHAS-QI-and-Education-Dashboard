// ---------------------------------------------------------------------------
// QI Resources — Curated documentation on quality improvement standards
//
// Single source of truth for the Resources page. Add new resources here and
// they will automatically appear in the appropriate category tab.
// ---------------------------------------------------------------------------

export interface QIResource {
  id: string;
  title: string;
  organization: string;
  category: ResourceCategory;
  description: string;
  url?: string; // external link
  keyPoints?: string[];
  tags?: string[];
}

export type ResourceCategory =
  | "ihi"
  | "ems-standards"
  | "spc"
  | "pdsa"
  | "measurement"
  | "leadership";

export const RESOURCE_CATEGORIES: Record<ResourceCategory, { label: string; description: string }> =
  {
    ihi: {
      label: "IHI & Model for Improvement",
      description:
        "Core resources from the Institute for Healthcare Improvement, including the Model for Improvement framework that drives the QI methodology used in this dashboard.",
    },
    "ems-standards": {
      label: "EMS Quality Standards",
      description:
        "National and international standards specific to Emergency Medical Services quality improvement, performance measurement, and system design.",
    },
    spc: {
      label: "Statistical Process Control",
      description:
        "Guides for understanding and applying SPC charts, control limits, variation analysis, and data-driven decision making in healthcare.",
    },
    pdsa: {
      label: "PDSA Methodology",
      description:
        "Detailed guidance on running effective Plan-Do-Study-Act cycles, from small tests of change through adoption and spread.",
    },
    measurement: {
      label: "Measurement & Metrics",
      description:
        "Best practices for selecting, defining, and tracking quality measures — outcome, process, and balancing measures.",
    },
    leadership: {
      label: "QI Leadership & Culture",
      description:
        "Resources on building a culture of quality improvement, engaging frontline staff, and sustaining improvement over time.",
    },
  };

// ---------------------------------------------------------------------------
// Resource entries
// ---------------------------------------------------------------------------

export const QI_RESOURCES: QIResource[] = [
  // --- IHI & Model for Improvement ---
  {
    id: "ihi-model",
    title: "The IHI Model for Improvement",
    organization: "Institute for Healthcare Improvement (IHI)",
    category: "ihi",
    description:
      "The foundational framework used by this dashboard. Built around three questions: What are we trying to accomplish? How will we know that a change is an improvement? What changes can we make that will result in improvement? Combined with PDSA cycles for testing changes.",
    url: "https://www.ihi.org/resources/how-to-improve",
    keyPoints: [
      "Set clear, measurable aims with specific targets and timelines",
      "Use three types of measures: outcome, process, and balancing",
      "Test changes with PDSA cycles before large-scale implementation",
      "Start small, learn fast, and scale what works",
      "Improvement requires iterative testing, not one-time projects",
    ],
    tags: ["framework", "core", "aims", "measures", "PDSA"],
  },
  {
    id: "ihi-science-improvement",
    title: "The Science of Improvement",
    organization: "Institute for Healthcare Improvement (IHI)",
    category: "ihi",
    description:
      "IHI's overview of improvement science principles — understanding variation, using data for learning (not just judgment), the psychology of change, and systems thinking. These concepts underpin every QI initiative.",
    url: "https://www.ihi.org/about/science-of-improvement",
    keyPoints: [
      "All improvement requires change, but not all change results in improvement",
      "Understanding variation is the key to rational decision-making",
      "Every system is perfectly designed to get the results it gets",
      "Sustainable improvement requires understanding the system, not just fixing symptoms",
    ],
    tags: ["theory", "variation", "systems thinking"],
  },
  {
    id: "ihi-qii-whitepaper",
    title: "Quality Improvement Essentials Toolkit",
    organization: "Institute for Healthcare Improvement (IHI)",
    category: "ihi",
    description:
      "A practical collection of QI tools and templates from IHI, including cause-and-effect diagrams, process flow charts, run charts, driver diagrams, and PDSA worksheets. Useful for teams getting started with structured improvement work.",
    url: "https://www.ihi.org/resources/tools/quality-improvement-essentials-toolkit",
    keyPoints: [
      "Includes fillable PDSA cycle worksheets",
      "Driver diagram templates for structuring improvement theories",
      "Run chart and control chart interpretation guides",
      "Cause-and-effect (fishbone) diagram templates",
    ],
    tags: ["tools", "templates", "worksheets"],
  },
  {
    id: "ihi-triple-aim",
    title: "The IHI Triple Aim",
    organization: "Institute for Healthcare Improvement (IHI)",
    category: "ihi",
    description:
      "IHI's framework for optimizing health system performance across three dimensions simultaneously: improving the patient experience of care, improving the health of populations, and reducing the per capita cost of healthcare. EMS QI efforts should connect to at least one of these dimensions.",
    url: "https://www.ihi.org/resources/triple-aim-optimizing-health-care",
    keyPoints: [
      "Patient Experience: timely, effective, safe, equitable care",
      "Population Health: prevention, wellness, reducing disease burden",
      "Per Capita Cost: eliminating waste, improving efficiency",
      "EMS directly impacts all three through response times, clinical quality, and operational efficiency",
    ],
    tags: ["strategy", "framework", "patient experience"],
  },

  // --- EMS Quality Standards ---
  {
    id: "nasemso-qi",
    title: "NASEMSO Quality Improvement Guide for EMS",
    organization: "National Association of State EMS Officials (NASEMSO)",
    category: "ems-standards",
    description:
      "NASEMSO's guide to implementing quality improvement programs in EMS agencies. Covers organizational readiness, QI committee structure, data collection, performance measurement, and PDSA-based improvement methodology adapted for prehospital care.",
    url: "https://nasemso.org/projects/performance-measures/",
    keyPoints: [
      "EMS agencies should have a formal QI plan with defined roles and responsibilities",
      "Performance measures should align with national consensus standards",
      "QI activities should be protected from punitive use under state QI privilege statutes",
      "Regular QI committee meetings (monthly or bi-weekly) sustain improvement momentum",
      "Peer review and case review are core EMS QI activities",
    ],
    tags: ["EMS", "organizational", "committee", "peer review"],
  },
  {
    id: "nhtsa-ems-agenda",
    title: "EMS Agenda 2050",
    organization: "National Highway Traffic Safety Administration (NHTSA)",
    category: "ems-standards",
    description:
      "NHTSA's vision for the future of EMS in the United States. Emphasizes data-driven quality improvement, outcome measurement, community-integrated health, and the shift from volume-based to value-based EMS delivery.",
    url: "https://www.ems.gov/ems-agenda-2050",
    keyPoints: [
      "EMS must evolve from a transport-focused model to a community-integrated health system",
      "Data-driven quality improvement is essential for demonstrating EMS value",
      "National performance standards enable meaningful benchmarking across agencies",
      "Technology and interoperability support better data collection and analysis",
    ],
    tags: ["EMS", "national", "vision", "future"],
  },
  {
    id: "nemsqa",
    title: "National EMS Quality Alliance (NEMSQA) Measures",
    organization: "NEMSQA",
    category: "ems-standards",
    description:
      "NEMSQA develops and endorses evidence-based EMS performance measures using a rigorous consensus process. These measures cover clinical care (cardiac arrest, stroke, trauma), safety, patient experience, and operational efficiency — many of which can be tracked through this dashboard.",
    url: "https://www.nemsqa.org/",
    keyPoints: [
      "Measures undergo multi-stakeholder review and field testing",
      "Focus areas include cardiac care, stroke, trauma, safety, and pediatrics",
      "Measures are designed to be feasible for EMS agencies of all sizes",
      "Aligned with the National EMS Information System (NEMSIS) data standard",
    ],
    tags: ["EMS", "measures", "evidence-based", "cardiac", "stroke"],
  },
  {
    id: "cpso-ems-qi",
    title: "Continuous Quality Improvement in EMS Systems",
    organization: "ACEP / NAEMSP",
    category: "ems-standards",
    description:
      "Joint position statement from the American College of Emergency Physicians and National Association of EMS Physicians on CQI in EMS. Establishes that every EMS system should have a physician-led CQI program with defined scope, regular review cycles, and measurable outcomes.",
    keyPoints: [
      "Medical direction and physician oversight are integral to EMS QI",
      "CQI programs should include prospective, concurrent, and retrospective review",
      "Clinical protocols should be evaluated and updated based on QI findings",
      "Benchmarking against peer agencies provides context for performance data",
    ],
    tags: ["EMS", "medical direction", "CQI", "protocols"],
  },

  // --- SPC ---
  {
    id: "spc-healthcare",
    title: "Understanding SPC Charts in Healthcare",
    organization: "IHI / NHS Improvement",
    category: "spc",
    description:
      "A guide to using Statistical Process Control (SPC) charts for healthcare quality improvement. Covers the difference between common cause and special cause variation, how to set control limits, when to react to data points, and common mistakes in chart interpretation.",
    keyPoints: [
      "Common cause variation is inherent noise — don't overreact to individual data points within control limits",
      "Special cause variation (points beyond limits, runs, trends) signals a real process change",
      "Control limits are calculated from the data, not set arbitrarily or based on targets",
      "SPC charts answer: 'Is this process stable and predictable?' before asking 'Is it good enough?'",
      "Recalculate control limits only after a confirmed, sustained process change",
    ],
    tags: ["SPC", "variation", "charts", "interpretation"],
  },
  {
    id: "spc-rules",
    title: "Nelson Rules & Western Electric Rules for SPC",
    organization: "Statistical Quality Control",
    category: "spc",
    description:
      "Reference guide for the detection rules used to identify special cause variation on control charts. These rules look for patterns beyond just single points above or below control limits — including runs, trends, and oscillations that signal non-random behavior.",
    keyPoints: [
      "Rule 1: One point beyond 3-sigma (control limit) — most common signal",
      "Rule 2: Nine consecutive points on one side of the center line (shift)",
      "Rule 3: Six consecutive points trending up or down (trend)",
      "Rule 4: Fourteen consecutive points alternating up and down (oscillation)",
      "Applying too many rules increases false positives — start with Rules 1-3",
    ],
    tags: ["SPC", "rules", "detection", "signals"],
  },

  // --- PDSA ---
  {
    id: "pdsa-deep-dive",
    title: "PDSA Cycles: A Practical Guide",
    organization: "IHI",
    category: "pdsa",
    description:
      "Detailed guidance on running effective PDSA cycles from IHI. Covers common pitfalls (cycles too large, no prediction, no data collection, skipping Study phase), ramp-up strategies, and how to link multiple cycles into a progression of learning.",
    url: "https://www.ihi.org/resources/tools/plan-do-study-act-pdsa-worksheet",
    keyPoints: [
      "The most common mistake is making cycles too large — start with 1 patient, 1 shift, 1 crew",
      "Always write a prediction BEFORE starting the Do phase",
      "Collect data during the test — don't rely on memory or anecdotal reports",
      "The Study phase is the most important and most often skipped",
      "Three outcomes: Adopt (implement), Adapt (modify and retest), Abandon (try something else)",
      "Most successful improvements take 3-5 PDSA cycles, not one",
    ],
    tags: ["PDSA", "cycles", "testing", "learning"],
  },
  {
    id: "pdsa-ramp",
    title: "PDSA Ramp: Scaling Successful Changes",
    organization: "IHI",
    category: "pdsa",
    description:
      "How to progressively expand the scope of a change once initial PDSA cycles show promise. The 'ramp' moves from a single test case to broader implementation through a series of increasingly ambitious cycles.",
    keyPoints: [
      "Cycle 1: Test with 1 crew on 1 shift on 1 day",
      "Cycle 2: Test with 3 crews over 1 week",
      "Cycle 3: Test with all crews at 1 station for 2 weeks",
      "Cycle 4: Implement across all stations for 1 month",
      "Each ramp-up is its own PDSA cycle with predictions and data collection",
      "Adapt the change at each scale if conditions differ",
    ],
    tags: ["PDSA", "scaling", "spread", "implementation"],
  },

  // --- Measurement ---
  {
    id: "family-measures",
    title: "The Three Types of Measures",
    organization: "IHI",
    category: "measurement",
    description:
      "IHI's framework for selecting a balanced set of measures for any improvement effort. Every initiative should track Outcome measures (did we achieve our aim?), Process measures (are we implementing the change?), and Balancing measures (are we causing harm elsewhere?).",
    keyPoints: [
      "Outcome measures reflect the aim statement — they tell you if you're improving",
      "Process measures tell you if the change is actually being implemented",
      "Balancing measures watch for unintended consequences in other parts of the system",
      "You don't need many measures — 3-5 well-chosen ones are better than 20",
      "Plot measures over time on run charts or SPC charts, not just before/after comparisons",
    ],
    tags: ["measures", "outcome", "process", "balancing"],
  },
  {
    id: "operational-definitions",
    title: "Writing Clear Operational Definitions",
    organization: "Quality Improvement",
    category: "measurement",
    description:
      "How to write precise operational definitions for metrics so that data is collected consistently. A good operational definition specifies exactly what to count, how to count it, and who counts it — eliminating ambiguity.",
    keyPoints: [
      "An operational definition has three parts: criteria, test method, and decision rule",
      "Different people measuring the same thing should get the same result",
      "Vague terms like 'timely,' 'appropriate,' or 'adequate' need explicit thresholds",
      "Test your definition by having two people independently apply it to the same cases",
      "Document your definitions in writing — memory and oral tradition create drift",
    ],
    tags: ["measures", "definitions", "data quality", "consistency"],
  },

  // --- Leadership & Culture ---
  {
    id: "qi-culture",
    title: "Building a Culture of Quality Improvement",
    organization: "IHI",
    category: "leadership",
    description:
      "How to create an organizational culture where quality improvement is everyone's responsibility, not just the QI department's. Covers psychological safety, leadership behaviors, frontline engagement, and sustaining improvement over time.",
    keyPoints: [
      "Psychological safety is prerequisite — staff must feel safe reporting errors and proposing changes",
      "Leaders should ask 'What can we improve?' not 'Who made the mistake?'",
      "Celebrate learning from failed PDSA cycles as much as successful ones",
      "Make improvement visible — display metrics, share stories, recognize contributors",
      "Allocate protected time for improvement work — it won't happen in spare time alone",
    ],
    tags: ["culture", "leadership", "safety", "engagement"],
  },
  {
    id: "qi-just-culture",
    title: "Just Culture in EMS Quality Improvement",
    organization: "NAEMSP / EMS QI",
    category: "leadership",
    description:
      "Applying Just Culture principles in an EMS QI program. Just Culture distinguishes between human error (console), at-risk behavior (coach), and reckless behavior (discipline), creating an environment where providers feel safe participating in quality improvement and reporting near-misses.",
    keyPoints: [
      "Human error: unintentional, system-designed to fail — console and fix the system",
      "At-risk behavior: behavioral choice where risk is not recognized — coach and remove incentives",
      "Reckless behavior: conscious disregard of known risk — appropriate disciplinary action",
      "QI data should be used for system improvement, not individual punishment",
      "State QI privilege statutes may protect QI proceedings from legal discovery",
    ],
    tags: ["culture", "just culture", "safety", "EMS", "reporting"],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getResourcesByCategory(category: ResourceCategory): QIResource[] {
  return QI_RESOURCES.filter((r) => r.category === category);
}

export function searchResources(query: string): QIResource[] {
  const q = query.toLowerCase();
  return QI_RESOURCES.filter(
    (r) =>
      r.title.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.organization.toLowerCase().includes(q) ||
      r.tags?.some((t) => t.toLowerCase().includes(q)) ||
      r.keyPoints?.some((kp) => kp.toLowerCase().includes(q))
  );
}
