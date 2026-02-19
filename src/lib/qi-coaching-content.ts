// ---------------------------------------------------------------------------
// QI Coaching Content — IHI Model for Improvement guidance
//
// Static coaching data used by the GuidedWizard to provide contextual help
// at each step. Based on IHI (Institute for Healthcare Improvement) best
// practices for quality improvement in healthcare settings.
// ---------------------------------------------------------------------------

export interface CoachingStep {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  tips: string[];
  examples: string[];
  guidingQuestions: string[];
}

export interface PhaseCoaching {
  title: string;
  description: string;
  guidingQuestions: string[];
  tips: string[];
}

// ---------------------------------------------------------------------------
// Wizard step coaching — one per guided wizard step
// ---------------------------------------------------------------------------

export const QI_COACHING_STEPS: CoachingStep[] = [
  {
    id: "aim",
    title: "Define Your Aim",
    subtitle: "What are you trying to accomplish?",
    description:
      "A strong aim statement is the foundation of any improvement effort. It should be SMART: Specific, Measurable, Achievable, Relevant, and Time-bound. The aim tells your team exactly what success looks like.",
    tips: [
      'Include a specific, numeric target (e.g., "reduce by 20%", "increase to 95%").',
      "Set a clear timeline — when will you evaluate whether you met the aim?",
      "Focus on one problem at a time. Broad aims dilute effort.",
      "Make the aim meaningful to front-line staff, not just leadership.",
      'Ask: "Will achieving this aim make a real difference for our patients or crews?"',
    ],
    examples: [
      "Reduce average on-scene time for cardiac arrest calls from 22 minutes to 18 minutes by Q4 2025.",
      "Increase the percentage of STEMI patients receiving 12-lead ECG within 5 minutes of patient contact from 72% to 90% by June 2025.",
      "Decrease medication administration errors from 3.2 per 1,000 transports to fewer than 1.5 per 1,000 transports within 6 months.",
    ],
    guidingQuestions: [
      "What specific outcome do you want to improve?",
      "How will you know that a change is an improvement?",
      "Who will be affected by this change?",
      "What is the current baseline performance?",
      "What is your target, and by when?",
    ],
  },
  {
    id: "measures",
    title: "Choose Your Measures",
    subtitle: "How will you know that a change is an improvement?",
    description:
      "Good measurement is essential. The IHI recommends three types of measures: Outcome measures (are you achieving your aim?), Process measures (are you implementing the change?), and Balancing measures (are you causing unintended consequences?). You don't need dozens of measures — a few well-chosen ones will tell the story.",
    tips: [
      "Start with your outcome measure — it should directly reflect your aim statement.",
      "Add 1-2 process measures that track whether the change is actually being implemented.",
      "Include at least one balancing measure to watch for unintended side effects.",
      "Use measures you can collect regularly (weekly or monthly) without heroic effort.",
      "Plot measures over time, not just before-and-after snapshots.",
    ],
    examples: [
      "Outcome: Average on-scene time for cardiac arrests (minutes).",
      "Process: Percentage of crews who completed the new protocol training.",
      "Balancing: Patient complaint rate (to ensure faster times don't compromise care quality).",
    ],
    guidingQuestions: [
      "What outcome measure directly reflects your aim?",
      "How will you know the change is being implemented consistently? (Process measure)",
      "Could this change inadvertently make something else worse? (Balancing measure)",
      "How frequently can you realistically collect this data?",
      "Is this measure already being tracked, or do you need a new data source?",
    ],
  },
  {
    id: "drivers",
    title: "Build Your Driver Diagram",
    subtitle: "What changes can you make that will result in improvement?",
    description:
      'A driver diagram maps the theory of change behind your improvement effort. Start with your aim, then identify Primary Drivers (the major areas that influence the aim), Secondary Drivers (actionable factors under each primary driver), and Change Ideas (specific, testable interventions). Think of it as a tree from "why" to "what to try."',
    tips: [
      "Start broad, then narrow. Primary drivers are big categories; change ideas are specific actions.",
      "Aim for 2-4 primary drivers — too many spreads focus thin.",
      "Each change idea should be small enough to test in a single PDSA cycle.",
      "Ask your front-line staff what they think the drivers are — they know best.",
      "It's okay to revise the diagram as you learn from PDSA cycles.",
    ],
    examples: [
      'Primary Driver: "Crew readiness and training" → Secondary: "Protocol familiarity" → Change Idea: "Laminated quick-reference cards in every rig"',
      'Primary Driver: "Equipment availability" → Secondary: "Medication kit organization" → Change Idea: "Color-coded medication pouches by protocol"',
    ],
    guidingQuestions: [
      "What are the 2-4 major areas that most influence this outcome?",
      "Under each primary driver, what specific factors can you actually influence?",
      "What is the smallest change you could test tomorrow?",
      "Which change idea would be easiest to test first?",
      "Are there changes your team has already talked about trying?",
    ],
  },
  {
    id: "pdsa",
    title: "Plan Your PDSA Cycles",
    subtitle: "Test changes on a small scale before spreading them",
    description:
      "PDSA (Plan-Do-Study-Act) cycles are the engine of improvement. Each cycle is a small, structured experiment: plan what you'll change and predict the result, do the test on a small scale, study the results against your prediction, and act on what you learned. Start with one cycle for one change idea. Most improvements take 3-5 cycles to refine.",
    tips: [
      "Start small — test with one crew, one shift, or one station before expanding.",
      "Write down your prediction before you start. It sharpens your thinking.",
      "Collect data during the test. Don't rely on memory or impressions.",
      "Each cycle should be short enough to learn from quickly (days to weeks, not months).",
      "After each cycle, decide: Adopt (keep the change), Adapt (modify and retest), or Abandon (try something else).",
    ],
    examples: [
      "Cycle 1: Test the new cardiac arrest checklist with one crew for 2 weeks. Predict: on-scene time will decrease by 2 minutes.",
      "Cycle 2 (after adapting): Revise the checklist based on crew feedback, retest with 3 crews for 2 weeks.",
    ],
    guidingQuestions: [
      "Which change idea will you test first?",
      "What do you predict will happen?",
      "How small can you make this test while still learning something useful?",
      "What data will you collect, and how?",
      "Who needs to be involved in this test?",
    ],
  },
  {
    id: "review",
    title: "Review & Launch",
    subtitle: "Check your strategy and start improving",
    description:
      "Before activating your campaign, review your improvement strategy end-to-end: Does the aim statement clearly define what you're trying to accomplish? Do the drivers logically connect to the aim? Are the change ideas specific and testable? Are PDSA cycles planned for at least your top priority change ideas? Remember: the plan will evolve as you learn. The goal isn't perfection — it's to start testing.",
    tips: [
      "Most successful improvements require 3-5 PDSA cycles. Don't expect to get it right the first time.",
      "Share the driver diagram with your team so everyone understands the strategy.",
      "Set a regular check-in cadence (weekly or bi-weekly) to review progress.",
      "Celebrate small wins to maintain momentum.",
      "Be willing to abandon change ideas that don't work — that's learning, not failure.",
    ],
    examples: [],
    guidingQuestions: [
      "Does your aim statement include a specific target and timeline?",
      "Can you see a clear path from your aim through drivers to change ideas?",
      "Are your PDSA cycles small and fast enough to learn quickly?",
      "Who else needs to know about this improvement effort?",
      "When will you hold your first progress review?",
    ],
  },
];

// ---------------------------------------------------------------------------
// PDSA phase-specific coaching — used in both wizard step 4 and stand-alone
// ---------------------------------------------------------------------------

export const PDSA_PHASE_COACHING: Record<string, PhaseCoaching> = {
  plan: {
    title: "Plan",
    description:
      "Define what you're going to change, predict what will happen, and plan how you'll collect data.",
    guidingQuestions: [
      "What exactly are you going to change or test?",
      "What do you predict will happen? Be specific.",
      "How will you collect data to know if your prediction was correct?",
      "Who will carry out the test? When and where?",
      "What could go wrong, and how will you handle it?",
    ],
    tips: [
      "Writing a specific prediction forces you to think clearly about what you expect.",
      "Plan your data collection before starting — it's hard to add it after the fact.",
      "Keep the test scope small: one crew, one shift, one station.",
    ],
  },
  do: {
    title: "Do",
    description:
      "Carry out the test on a small scale. Document what actually happens, especially the unexpected.",
    guidingQuestions: [
      "Did the test go as planned?",
      "What happened that you didn't expect?",
      "Were there any problems with implementing the change?",
      "Did you collect the data as planned?",
      "What did you observe that won't show up in the data?",
    ],
    tips: [
      "Document everything in real time. Memories fade fast.",
      "Note the unexpected observations — they're often the most valuable learnings.",
      "Don't adjust the plan mid-test unless there's a safety concern.",
    ],
  },
  study: {
    title: "Study",
    description:
      "Analyze the data and compare what happened to what you predicted. What did you learn?",
    guidingQuestions: [
      "What do the data show? Compare to your prediction.",
      "Was your prediction correct? If not, why not?",
      "What surprised you?",
      "What would you do differently next time?",
      "Is this change ready to adopt, or does it need adapting?",
    ],
    tips: [
      "Compare results to your prediction, not just to the baseline.",
      "Look beyond the numbers — what did people say? What did you observe?",
      "Be honest about what didn't work. That's the whole point of testing.",
    ],
  },
  act: {
    title: "Act",
    description:
      "Based on what you learned, decide: Adopt (implement the change), Adapt (modify and retest), or Abandon (try a different approach).",
    guidingQuestions: [
      "Should you adopt, adapt, or abandon this change?",
      "If adopting: How will you spread this change to more crews/stations?",
      "If adapting: What specific modifications will you make for the next cycle?",
      "If abandoning: What did you learn that will inform your next test?",
      "What's the next PDSA cycle?",
    ],
    tips: [
      "Don't feel pressured to adopt. Adapting or abandoning is learning, not failure.",
      "If adapting, be specific about what you're changing for the next cycle.",
      "Most improvements require 3-5 cycles. Plan your next test before losing momentum.",
    ],
  },
};

// ---------------------------------------------------------------------------
// Step labels for the wizard stepper
// ---------------------------------------------------------------------------

export const WIZARD_STEP_LABELS = ["Aim", "Measures", "Diagram", "PDSA", "Review"] as const;
export type WizardStepIndex = 0 | 1 | 2 | 3 | 4;
