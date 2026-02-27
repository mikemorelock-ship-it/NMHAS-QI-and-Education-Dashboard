// ---------------------------------------------------------------------------
// Root Cause Analysis Content — guided coaching for RCA investigations
//
// Provides structured content for Fishbone/Ishikawa diagrams, 5 Whys
// technique, and combined RCA approaches.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Fishbone / Ishikawa categories for healthcare/EMS
// ---------------------------------------------------------------------------

export interface FishboneCategory {
  id: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  promptQuestions: string[];
  examples: string[];
}

export const FISHBONE_CATEGORIES: FishboneCategory[] = [
  {
    id: "people",
    label: "People",
    description:
      "Staff-related factors including training, experience, fatigue, communication, and competency.",
    icon: "Users",
    color: "#3b82f6",
    promptQuestions: [
      "Were the staff appropriately trained for this situation?",
      "Was there adequate staffing at the time?",
      "Was fatigue or stress a contributing factor?",
      "Were there communication breakdowns between team members?",
      "Was there a competency or experience gap?",
      "Were roles and responsibilities clearly defined?",
    ],
    examples: [
      "Paramedic had not completed recertification on updated protocol",
      "Crew was on hour 14 of a 12-hour shift",
      "Handoff communication between crews was incomplete",
      "New employee without adequate field experience for the call type",
    ],
  },
  {
    id: "process",
    label: "Process / Procedures",
    description:
      "Protocol, workflow, and procedure-related factors including missing or outdated guidelines.",
    icon: "ClipboardList",
    color: "#8b5cf6",
    promptQuestions: [
      "Was there a standard protocol for this situation?",
      "Was the protocol current and easily accessible?",
      "Were there ambiguous or conflicting guidelines?",
      "Was the workflow designed efficiently for this scenario?",
      "Were there too many or too few steps in the process?",
      "Was there a deviation from the standard procedure? If so, why?",
    ],
    examples: [
      "Protocol did not address this specific patient presentation",
      "Standing order was outdated and conflicted with current evidence",
      "No standardized checklist existed for this procedure",
      "Workaround had become normalized because the official process was cumbersome",
    ],
  },
  {
    id: "equipment",
    label: "Equipment / Technology",
    description: "Equipment malfunction, unavailability, design issues, or technology failures.",
    icon: "Wrench",
    color: "#f59e0b",
    promptQuestions: [
      "Was all necessary equipment available and functioning?",
      "Was the equipment properly maintained?",
      "Was there a design issue that contributed to the error?",
      "Did technology (software, monitors, radios) perform as expected?",
      "Was the equipment age or condition a factor?",
      "Were there compatibility issues between different equipment?",
    ],
    examples: [
      "Cardiac monitor battery died during patient assessment",
      "IV pump delivered an incorrect rate due to a calibration error",
      "Radio system experienced dead zones, preventing communication",
      "Ambulance stretcher malfunctioned during patient loading",
    ],
  },
  {
    id: "environment",
    label: "Environment",
    description:
      "Physical, scene, and environmental factors including weather, lighting, noise, and distractions.",
    icon: "Cloud",
    color: "#10b981",
    promptQuestions: [
      "Did weather or road conditions affect the response?",
      "Was lighting adequate at the scene?",
      "Was noise a barrier to communication or assessment?",
      "Were there scene safety concerns that affected care?",
      "Were there distractions at the scene?",
      "Did the physical space (e.g., confined area) limit the team's ability to provide care?",
    ],
    examples: [
      "Low lighting made it difficult to read medication labels",
      "Heavy rain delayed response time by 8 minutes",
      "Bystander interference distracted the crew during a critical procedure",
      "Narrow stairway prevented effective CPR during extrication",
    ],
  },
  {
    id: "management",
    label: "Management / Organization",
    description:
      "Leadership, culture, policy, resource allocation, and organizational system factors.",
    icon: "Building2",
    color: "#ef4444",
    promptQuestions: [
      "Were staffing decisions appropriate for the call volume?",
      "Did organizational policies support or hinder the correct action?",
      "Was there adequate supervision or oversight?",
      "Was the organizational culture supportive of reporting errors?",
      "Were resources allocated appropriately?",
      "Did leadership communicate expectations clearly?",
    ],
    examples: [
      "Budget cuts reduced training hours from 40 to 20 per year",
      "Fear of punishment discouraged crews from reporting near-misses",
      "No system existed for tracking equipment maintenance schedules",
      "Mandatory overtime policy led to chronic fatigue across the division",
    ],
  },
  {
    id: "materials",
    label: "Materials / Supplies",
    description:
      "Supply-related factors including availability, quality, expiration, and organization of materials.",
    icon: "Package",
    color: "#ec4899",
    promptQuestions: [
      "Were all necessary supplies available?",
      "Were any supplies expired or compromised?",
      "Were supplies organized in a way that prevented errors?",
      "Was there a supply chain issue that contributed?",
      "Were look-alike or sound-alike items a factor?",
      "Was the quality of supplies adequate?",
    ],
    examples: [
      "Medication was expired but not removed from the kit",
      "Similar-looking vials led to the wrong medication being selected",
      "Key supply was out of stock due to a vendor issue",
      "Supplies were disorganized, causing delay in locating needed items",
    ],
  },
];

// ---------------------------------------------------------------------------
// 5 Whys guidance
// ---------------------------------------------------------------------------

export interface FiveWhysGuidance {
  level: number;
  prompt: string;
  tip: string;
  checkQuestion: string;
}

export const FIVE_WHYS_GUIDANCE: FiveWhysGuidance[] = [
  {
    level: 1,
    prompt: "Why did this happen?",
    tip: "Start with the immediate, direct cause. Stick to facts — avoid assumptions or blame.",
    checkQuestion:
      "Is this the direct, immediate cause? Or are you jumping ahead to a deeper cause?",
  },
  {
    level: 2,
    prompt: "Why did that happen?",
    tip: "Look for the process or system factor behind the immediate cause. Focus on what allowed the first cause to occur.",
    checkQuestion: "Is this cause factual and verified, or is it an assumption?",
  },
  {
    level: 3,
    prompt: "Why did that happen?",
    tip: "You are moving toward systemic factors now. Look for training, design, or organizational contributors.",
    checkQuestion: "Are you staying focused on the system, not blaming an individual?",
  },
  {
    level: 4,
    prompt: "Why did that happen?",
    tip: "At this level, you should be approaching a root cause — something your organization can actually change.",
    checkQuestion:
      "If you fixed this cause, would it significantly reduce the chance of recurrence?",
  },
  {
    level: 5,
    prompt: "Why did that happen?",
    tip: "You should now be at or near a root cause. Ask: is this actionable? Can your organization make a change here?",
    checkQuestion:
      "Is this within your organization's ability to change? If yes, you may have found a root cause.",
  },
];

// ---------------------------------------------------------------------------
// RCA method descriptions
// ---------------------------------------------------------------------------

export interface RcaMethod {
  id: string;
  name: string;
  shortName: string;
  description: string;
  bestFor: string;
  steps: string[];
  icon: string;
}

export const RCA_METHODS: RcaMethod[] = [
  {
    id: "fishbone",
    name: "Fishbone / Ishikawa Diagram",
    shortName: "Fishbone",
    description:
      "A visual tool that organizes potential causes into categories (People, Process, Equipment, Environment, Management, Materials). Best for complex events with multiple contributing factors.",
    bestFor:
      "Complex events where you need to explore multiple categories of contributing factors systematically.",
    steps: [
      "Define the problem statement clearly",
      "Explore each category for contributing factors",
      "Drill deeper into each factor to understand the chain of causation",
      "Identify the most significant root causes",
      "Develop corrective and preventive actions",
    ],
    icon: "GitBranchPlus",
  },
  {
    id: "five_whys",
    name: "5 Whys Analysis",
    shortName: "5 Whys",
    description:
      "An iterative technique that asks 'Why?' repeatedly to peel back layers of symptoms and reach the root cause. Simple and effective for straightforward cause-and-effect chains.",
    bestFor:
      "Simpler events with a relatively linear cause-and-effect chain, or when you want to quickly drill into a specific contributing factor.",
    steps: [
      "Define the problem statement",
      "Ask 'Why did this happen?' and document the answer",
      "For each answer, ask 'Why?' again",
      "Continue until you reach an actionable root cause (typically 3-7 levels)",
      "Verify the root cause and develop corrective actions",
    ],
    icon: "HelpCircle",
  },
  {
    id: "combined",
    name: "Combined Analysis",
    shortName: "Combined",
    description:
      "Use a Fishbone diagram to identify contributing factors across categories, then apply 5 Whys to drill into the most significant factors. Combines breadth with depth.",
    bestFor:
      "Comprehensive investigations where you want both a broad view of contributing factors and deep analysis of the most critical ones.",
    steps: [
      "Define the problem statement",
      "Use the Fishbone to brainstorm contributing factors across all categories",
      "Identify the 2-3 most significant contributing factors",
      "Apply 5 Whys to each significant factor to find root causes",
      "Consolidate root causes and develop corrective and preventive actions",
    ],
    icon: "Layers",
  },
];

// ---------------------------------------------------------------------------
// Severity levels
// ---------------------------------------------------------------------------

export const SEVERITY_LEVELS = [
  {
    value: "low",
    label: "Low",
    description: "Minor issue, no patient harm, minimal operational impact",
    color: "bg-blue-100 text-blue-800",
  },
  {
    value: "medium",
    label: "Medium",
    description: "Moderate issue, potential for harm, some operational impact",
    color: "bg-yellow-100 text-yellow-800",
  },
  {
    value: "high",
    label: "High",
    description: "Serious issue, patient harm occurred or was narrowly avoided",
    color: "bg-orange-100 text-orange-800",
  },
  {
    value: "critical",
    label: "Critical",
    description: "Severe event, significant patient harm or system-wide failure",
    color: "bg-red-100 text-red-800",
  },
] as const;

// ---------------------------------------------------------------------------
// RCA coaching tips
// ---------------------------------------------------------------------------

export const RCA_COACHING = {
  general: {
    title: "Root Cause Analysis Coaching",
    description:
      "RCA is a systematic approach to identifying the fundamental causes of adverse events. The goal is to understand what happened and why, so you can prevent it from happening again.",
    tips: [
      "Focus on systems and processes, not individual blame",
      "Ask 'why' not 'who' — look for the conditions that allowed the event to occur",
      "Include frontline staff in the investigation — they know the work best",
      "Look for multiple contributing factors, not just a single cause",
      "Strongest corrective actions change the system; weakest just add training or policy",
    ],
    guidingQuestions: [
      "What happened? (Objective description of the event)",
      "When did it happen? (Timeline of events)",
      "Where did it happen? (Scene, unit, facility)",
      "Who was involved? (Roles, not blame)",
      "What was different about this time? (What changed from normal operations?)",
    ],
  },
  actionHierarchy: [
    {
      level: "Strongest",
      actions: [
        "Architectural or physical design changes",
        "Forcing functions (make it impossible to do the wrong thing)",
        "Technology solutions and automation",
      ],
      description:
        "These changes don't rely on human vigilance and are the most effective at preventing recurrence.",
    },
    {
      level: "Moderate",
      actions: [
        "Standardized processes and checklists",
        "Simplification of workflows",
        "Built-in redundancies and double-checks",
      ],
      description: "These changes make the right action easier and more consistent.",
    },
    {
      level: "Weakest",
      actions: [
        "Additional training or education",
        "New policies or procedures",
        "Warnings, labels, or reminders",
      ],
      description:
        "These rely on human memory and attention, which are inherently unreliable under stress.",
    },
  ],
};
