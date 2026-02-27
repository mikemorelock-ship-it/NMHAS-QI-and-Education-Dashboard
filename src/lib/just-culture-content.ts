// ---------------------------------------------------------------------------
// Just Culture Algorithm Content — guided decision tree
//
// Based on the Just Culture model by David Marx / Outcome Engenuity.
// Provides structured step-by-step decision support for evaluating
// individual behavior in the context of adverse events.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Algorithm steps
// ---------------------------------------------------------------------------

export interface AlgorithmStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  question: string;
  guidance: string[];
  /** If present, these are the possible answers with their destinations */
  options: AlgorithmOption[];
  /** Educational tip shown to help the evaluator */
  educationalNote?: string;
}

export interface AlgorithmOption {
  label: string;
  value: string;
  description: string;
  /** Where to go next: another step ID, or a terminal result */
  nextStepId: string | null;
  /** If nextStepId is null, this is the terminal result */
  result?: AlgorithmResult;
}

export interface AlgorithmResult {
  behaviorType: "system_issue" | "human_error" | "at_risk" | "reckless";
  recommendation: "system_fix" | "console" | "coach" | "discipline";
  label: string;
  description: string;
  actions: string[];
  color: string;
  icon: string;
}

// ---------------------------------------------------------------------------
// Terminal results
// ---------------------------------------------------------------------------

export const ALGORITHM_RESULTS: Record<string, AlgorithmResult> = {
  system_fix: {
    behaviorType: "system_issue",
    recommendation: "system_fix",
    label: "System Redesign",
    description:
      "No individual behavioral issue was identified. The system itself produced the outcome. Focus entirely on redesigning the system to prevent recurrence.",
    actions: [
      "Analyze the system design that led to the outcome",
      "Identify process, equipment, or environmental improvements",
      "Implement system-level corrective actions",
      "No individual corrective action is needed",
      "Share learnings across the organization",
    ],
    color: "bg-blue-50 border-blue-200 text-blue-900",
    icon: "Settings",
  },
  console: {
    behaviorType: "human_error",
    recommendation: "console",
    label: "Console",
    description:
      "This was a human error — an inadvertent action where the individual did not intend to deviate. The person likely already feels distressed. Focus on emotional support and system redesign.",
    actions: [
      "Provide emotional support — the individual is likely a 'second victim'",
      "Reinforce that the error was not a behavioral choice",
      "Analyze system factors that allowed the error to occur or reach the patient",
      "Implement system-level changes (forcing functions, checklists, automation)",
      "Do NOT retrain the individual on something they already know",
      "Share learnings without identifying the individual",
    ],
    color: "bg-green-50 border-green-200 text-green-900",
    icon: "Heart",
  },
  coach: {
    behaviorType: "at_risk",
    recommendation: "coach",
    label: "Coach",
    description:
      "This was at-risk behavior — a conscious choice where the individual did not appreciate the risk, or believed the risk was justified. Focus on helping them see the risk and removing system incentives for the risky behavior.",
    actions: [
      "Help the individual understand the risk they did not appreciate",
      "Identify why the at-risk behavior was attractive (saves time, easier, workaround)",
      "Remove incentives for the at-risk behavior",
      "Create incentives for safe behavior — make the safe way the easy way",
      "If the substitution test shows most would do the same, prioritize system redesign",
      "Set clear expectations for future behavior",
      "Follow up to ensure the behavior changes",
      "Do NOT punish — punishment drives reporting underground",
    ],
    color: "bg-amber-50 border-amber-200 text-amber-900",
    icon: "MessageCircle",
  },
  discipline: {
    behaviorType: "reckless",
    recommendation: "discipline",
    label: "Remedial / Disciplinary Action",
    description:
      "This was reckless behavior — a conscious disregard of a substantial and unjustifiable risk. Disciplinary action proportional to the behavioral choice (not the outcome) is appropriate.",
    actions: [
      "Apply disciplinary action proportional to the behavior, not the outcome",
      "May include retraining, probation, suspension, or termination",
      "Formally document the behavioral expectation and the deviation",
      "Communicate clearly why the behavior was reckless",
      "Even in this case, look for system factors that made reckless behavior possible",
      "Send an organizational message that conscious disregard of risk is not tolerated",
    ],
    color: "bg-red-50 border-red-200 text-red-900",
    icon: "AlertTriangle",
  },
};

// ---------------------------------------------------------------------------
// Algorithm steps
// ---------------------------------------------------------------------------

export const ALGORITHM_STEPS: AlgorithmStep[] = [
  {
    id: "step_1",
    stepNumber: 1,
    title: "Event Description",
    description:
      "Start by describing what happened objectively. Separate the outcome from the behavior — Just Culture evaluates behavior, not the luck of the outcome.",
    question: "Describe the event. What happened?",
    guidance: [
      "Be objective and factual — avoid emotional language",
      "Focus on what happened, not who is at fault",
      "Include relevant context (time, location, conditions)",
      "Two people can make the same choice — one causes harm, one doesn't. Evaluate the behavior, not the outcome.",
    ],
    options: [
      {
        label: "Continue",
        value: "continue",
        description: "Proceed to the next step",
        nextStepId: "step_2",
      },
    ],
    educationalNote:
      "The Just Culture model evaluates the behavioral choice, not the outcome. A near-miss involving reckless behavior is treated the same as a serious harm event involving reckless behavior.",
  },
  {
    id: "step_2",
    stepNumber: 2,
    title: "Duty or Protocol Breach",
    description:
      'Determine whether the individual breached a duty, violated a protocol, or deviated from expected practice. "Duty" includes following training, adhering to standards of care, following protocols, and general professional responsibilities.',
    question: "Was a policy, procedure, protocol, or professional duty violated or breached?",
    guidance: [
      "Consider written protocols, standing orders, and standards of care",
      "Include unwritten but clearly established professional expectations",
      "If the individual followed all rules and the outcome was still bad, the system designed the outcome",
      "Remember: the absence of a protocol is itself a system issue",
    ],
    options: [
      {
        label: "No — the individual followed all applicable rules and expectations",
        value: "no",
        description:
          "The system itself produced the outcome. No individual behavioral issue exists.",
        nextStepId: null,
        result: ALGORITHM_RESULTS.system_fix,
      },
      {
        label: "Yes — a duty, protocol, or expectation was breached",
        value: "yes",
        description: "Proceed to evaluate the nature of the breach.",
        nextStepId: "step_3",
      },
    ],
    educationalNote:
      "If the individual did everything they were supposed to do and the outcome was still bad, the focus should be entirely on improving the system — not on the individual.",
  },
  {
    id: "step_3",
    stepNumber: 3,
    title: "Intent to Harm",
    description:
      "Determine whether the individual intended to cause harm. Intentional harm is extremely rare in healthcare and falls outside the scope of Just Culture — it is a criminal or HR matter.",
    question: "Did the individual intend to cause harm?",
    guidance: [
      "Intentional harm means the person deliberately set out to hurt someone",
      "This is extremely rare — do not confuse poor judgment with malicious intent",
      "Reckless behavior is NOT intentional harm — the person did not want a bad outcome",
      "If there is any doubt, proceed to the next step",
    ],
    options: [
      {
        label: "Yes — the individual deliberately intended to cause harm",
        value: "yes",
        description:
          "Intentional harm is outside the scope of Just Culture. Refer to law enforcement or HR.",
        nextStepId: null,
        result: {
          behaviorType: "reckless",
          recommendation: "discipline",
          label: "Intentional Harm — Outside Just Culture Scope",
          description:
            "Intentional harm is a criminal or HR matter, not a Just Culture issue. Refer to the appropriate authority immediately.",
          actions: [
            "Refer to law enforcement if criminal conduct is suspected",
            "Involve Human Resources for employment action",
            "Document all facts and preserve evidence",
            "Ensure patient/victim safety",
            "This is outside the scope of the Just Culture framework",
          ],
          color: "bg-red-100 border-red-300 text-red-900",
          icon: "ShieldAlert",
        },
      },
      {
        label: "No — the individual did not intend to cause harm",
        value: "no",
        description: "Proceed to evaluate the circumstances.",
        nextStepId: "step_4",
      },
    ],
    educationalNote:
      "Intentional harm is vanishingly rare in healthcare. Most adverse events result from human error or behavioral choices made with good intentions.",
  },
  {
    id: "step_4",
    stepNumber: 4,
    title: "Substance Impairment",
    description:
      "Determine whether drugs or alcohol were involved. Substance impairment fundamentally changes the analysis and follows a separate pathway.",
    question: "Were drugs or alcohol involved that may have impaired the individual's performance?",
    guidance: [
      "This includes both illegal substances and prescription medications that impair function",
      "Consider whether the individual was impaired, not just whether substances were present",
      "Most organizations have separate substance abuse policies for this situation",
      "If unsure, follow your organization's substance testing protocol",
    ],
    options: [
      {
        label: "Yes — substance impairment was involved",
        value: "yes",
        description:
          "Follow your organization's substance abuse policy. This typically involves testing, EAP referral, and potential disciplinary action.",
        nextStepId: null,
        result: {
          behaviorType: "reckless",
          recommendation: "discipline",
          label: "Substance Impairment — Separate Pathway",
          description:
            "Substance impairment follows a separate organizational pathway, typically involving mandatory testing, Employee Assistance Program referral, and potential disciplinary action per your substance abuse policy.",
          actions: [
            "Follow your organization's substance abuse policy",
            "Arrange for substance testing per policy",
            "Refer to Employee Assistance Program (EAP)",
            "Ensure patient safety — remove the individual from patient care duties",
            "Document per policy requirements",
            "Consider whether system factors made impairment detection difficult",
          ],
          color: "bg-orange-100 border-orange-300 text-orange-900",
          icon: "AlertOctagon",
        },
      },
      {
        label: "No — substance impairment was not a factor",
        value: "no",
        description: "Proceed to evaluate the nature of the deviation.",
        nextStepId: "step_5",
      },
    ],
  },
  {
    id: "step_5",
    stepNumber: 5,
    title: "Inadvertent vs. Conscious Deviation",
    description:
      "This is the critical distinction between human error and a behavioral choice. Determine whether the individual's deviation was inadvertent (unintentional) or a conscious choice.",
    question:
      "Was the deviation inadvertent (unintentional), or did the individual make a conscious choice to deviate?",
    guidance: [
      "Inadvertent means the person intended to do the right thing but made a slip, lapse, or mistake",
      "A slip is an action-based error (grabbed the wrong item)",
      "A lapse is a memory-based error (forgot a step)",
      "A mistake is a knowledge-based error (made a wrong decision based on incorrect understanding)",
      "A conscious choice means the person deliberately chose to do something differently than expected",
      "Ask: 'Did the individual intend to deviate, or did they intend to follow the correct practice?'",
    ],
    options: [
      {
        label:
          "Inadvertent — the individual intended to follow protocol but made an unintentional error",
        value: "inadvertent",
        description:
          "This is a human error. The appropriate response is to console the individual and focus on system redesign.",
        nextStepId: null,
        result: ALGORITHM_RESULTS.console,
      },
      {
        label:
          "Conscious choice — the individual deliberately chose to deviate from expected practice",
        value: "conscious",
        description: "The individual made a behavioral choice. Proceed to evaluate why.",
        nextStepId: "step_6",
      },
    ],
    educationalNote:
      "Most adverse events in healthcare are human errors — inadvertent actions by well-intentioned people. The system should be designed to catch these errors before they reach the patient.",
  },
  {
    id: "step_6",
    stepNumber: 6,
    title: "The Substitution Test",
    description:
      'The Substitution Test asks: "Would another individual with comparable training and experience, in the same situation, be likely to make the same behavioral choice?" This determines whether the behavior is an individual issue or a system/culture issue.',
    question:
      "Would a similarly trained and experienced person, in the same situation, likely make the same behavioral choice?",
    guidance: [
      "Think of a typical competent professional in this role — not the best or the worst",
      "Consider all contextual factors: workload, time pressure, staffing, available information",
      "Is this deviation common practice? Do many people do it this way?",
      "Has the organization implicitly tolerated or encouraged this deviation?",
      "If most peers would do the same, it's a system/culture problem, not an individual problem",
    ],
    options: [
      {
        label: "Yes — most peers would make the same choice in this situation",
        value: "yes",
        description:
          "This behavior has been normalized in the organization. It's a system/culture problem. Coach the individual and prioritize system redesign.",
        nextStepId: null,
        result: ALGORITHM_RESULTS.coach,
      },
      {
        label: "No — most peers would NOT make the same choice",
        value: "no",
        description:
          "This appears to be an individual behavioral choice. Proceed to evaluate further.",
        nextStepId: "step_7",
      },
    ],
    educationalNote:
      "The Substitution Test prevents scapegoating individuals for system failures. If the system is driving the behavior, fixing the individual won't fix the problem — it will just happen to someone else.",
  },
  {
    id: "step_7",
    stepNumber: 7,
    title: "System Contributing Factors",
    description:
      "Evaluate whether significant deficiencies in training, supervision, or system design contributed to the individual's behavioral choice.",
    question:
      "Were there significant deficiencies in training, supervision, or system design that contributed to the behavioral choice?",
    guidance: [
      "Was the individual adequately trained on the expected behavior?",
      "Was supervision appropriate for the individual's experience level?",
      "Did the system make it difficult to do the right thing?",
      "Were there conflicting pressures (time, production, competing priorities)?",
      "Was the expected behavior clearly communicated and reinforced?",
    ],
    options: [
      {
        label: "Yes — system deficiencies contributed to the choice",
        value: "yes",
        description:
          "At-risk behavior with system contribution. Coach the individual and fix the system gaps.",
        nextStepId: null,
        result: ALGORITHM_RESULTS.coach,
      },
      {
        label:
          "No — the system provided adequate support and the individual still chose to deviate",
        value: "no",
        description: "Proceed to evaluate the nature of the risk awareness.",
        nextStepId: "step_8",
      },
    ],
  },
  {
    id: "step_8",
    stepNumber: 8,
    title: "Conscious Disregard of Risk",
    description:
      'This is the final determination: did the individual consciously disregard a substantial and unjustifiable risk? "Substantial" means the risk was significant. "Unjustifiable" means there was no reasonable benefit that outweighed the risk.',
    question: "Did the individual consciously disregard a substantial and unjustifiable risk?",
    guidance: [
      "Did the individual KNOW the risk was significant?",
      "Was the risk substantial — not minor or theoretical?",
      "Was there any reasonable justification for taking the risk?",
      "Consider: did the person believe (even incorrectly) that the benefit outweighed the risk?",
      "Reckless behavior is rare — most deviations fall into the at-risk category",
    ],
    options: [
      {
        label:
          "No — the individual did not appreciate the risk as substantial, or believed it was justified",
        value: "no",
        description: "At-risk behavior. Coach the individual to help them see the risk.",
        nextStepId: null,
        result: ALGORITHM_RESULTS.coach,
      },
      {
        label:
          "Yes — the individual knew the risk was substantial and unjustifiable and proceeded anyway",
        value: "yes",
        description:
          "Reckless behavior. Disciplinary action proportional to the behavior is appropriate.",
        nextStepId: null,
        result: ALGORITHM_RESULTS.discipline,
      },
    ],
    educationalNote:
      "Reckless behavior is rare in healthcare. Most people who deviate from expected practice do so because they don't appreciate the risk, or because system factors make the deviation attractive. Reserve discipline for true conscious disregard of substantial risk.",
  },
];

// ---------------------------------------------------------------------------
// Key principles for display
// ---------------------------------------------------------------------------

export const JUST_CULTURE_PRINCIPLES = [
  {
    title: "Separate Behavior from Outcome",
    description:
      "Evaluate the behavioral choice, not the severity of the outcome. Two people can make the same choice — one causes harm, one doesn't.",
  },
  {
    title: "Avoid Hindsight Bias",
    description:
      'Consider only what the individual knew or could have known at the time — not what became clear after the fact. Avoid "they should have known."',
  },
  {
    title: "Avoid Outcome Bias",
    description:
      "Don't judge behavior more harshly because the outcome was worse. The same behavior deserves the same response regardless of outcome.",
  },
  {
    title: "Systems Focus",
    description:
      "Even when individual behavior is at issue, always look for system factors. Systems should be designed to account for human fallibility.",
  },
  {
    title: "Consistency",
    description:
      "The primary value of the algorithm is producing consistent responses across different evaluators and events. Follow the steps every time.",
  },
  {
    title: "Support Reporting",
    description:
      "A just culture encourages reporting by distinguishing between errors (blameless) and choices (accountable). Punishing human error drives reporting underground.",
  },
];
