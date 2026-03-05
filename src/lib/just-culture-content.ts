// ---------------------------------------------------------------------------
// Just Culture Algorithm Content — guided decision tree
//
// Based on the Just Culture model by David Marx / Outcome Engenuity and the
// NHS Incident Decision Tree (James Reason). Implements the four sequential
// tests: Deliberate Harm, Incapacity/Health, Foresight, and Substitution,
// combined with the Marx behavioral classification (Human Error → Console,
// At-Risk Behavior → Coach, Reckless Behavior → Discipline).
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
  behaviorType:
    | "system_issue"
    | "human_error"
    | "at_risk"
    | "reckless"
    | "intentional_harm"
    | "incapacity";
  recommendation: "system_fix" | "console" | "coach" | "discipline" | "referral" | "health_pathway";
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
  intentional_harm: {
    behaviorType: "intentional_harm",
    recommendation: "referral",
    label: "Intentional Harm — Outside Just Culture Scope",
    description:
      "Intentional harm is a criminal or HR matter, not a Just Culture issue. The individual deliberately set out to cause harm. Refer to the appropriate authority immediately.",
    actions: [
      "Refer to law enforcement if criminal conduct is suspected",
      "Involve Human Resources for immediate employment action",
      "Document all facts and preserve evidence",
      "Ensure patient/victim safety and remove individual from duties",
      "This is outside the scope of the Just Culture framework",
    ],
    color: "bg-red-100 border-red-300 text-red-900",
    icon: "ShieldAlert",
  },
  health_pathway: {
    behaviorType: "incapacity",
    recommendation: "health_pathway",
    label: "Incapacity / Health Pathway",
    description:
      "The individual's performance was impaired by a physical health condition, mental health condition, or substance use. This is not a behavioral choice — it requires a supportive, health-focused response.",
    actions: [
      "Remove the individual from patient care duties to ensure safety",
      "Refer to Occupational Health for medical assessment",
      "Refer to Employee Assistance Program (EAP) for support",
      "If substance-related, follow your organization's substance abuse policy",
      "Consider reasonable adjustments to duties during recovery",
      "Assess whether the individual was aware of their condition and its implications",
      "If the individual knowingly concealed a condition that put patients at risk, re-evaluate under the Foresight Test",
      "Ensure confidentiality and avoid stigmatization",
    ],
    color: "bg-purple-50 border-purple-200 text-purple-900",
    icon: "HeartPulse",
  },
  system_fix: {
    behaviorType: "system_issue",
    recommendation: "system_fix",
    label: "System Redesign",
    description:
      "No individual behavioral issue was identified. The system itself produced the outcome — protocols were absent, unclear, conflicting, or inadequate. Focus entirely on redesigning the system to prevent recurrence.",
    actions: [
      "Analyze the system design that led to the outcome",
      "Identify whether protocols were absent, unclear, conflicting, or unworkable in practice",
      "Implement system-level corrective actions (forcing functions, checklists, automation)",
      "No individual corrective action is needed",
      "Share learnings across the organization",
      "Update or create clear, workable protocols",
    ],
    color: "bg-blue-50 border-blue-200 text-blue-900",
    icon: "Settings",
  },
  console: {
    behaviorType: "human_error",
    recommendation: "console",
    label: "Console",
    description:
      "This was a human error — an inadvertent action where the individual did not intend to deviate. The person likely already feels distressed. Focus on emotional support and system redesign to catch future errors.",
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
// Algorithm steps — structured around the four sequential tests
// ---------------------------------------------------------------------------

export const ALGORITHM_STEPS: AlgorithmStep[] = [
  // -----------------------------------------------------------------------
  // Step 1: TEST 1 — Deliberate Harm Test
  // -----------------------------------------------------------------------
  {
    id: "step_1",
    stepNumber: 1,
    title: "Test 1: Deliberate Harm Test",
    description:
      "The Deliberate Harm Test identifies whether the individual intended to cause harm. In the overwhelming majority of incidents, the individual had the patient's wellbeing at heart. However, in exceedingly rare cases the intent was to cause harm. This test eliminates or confirms that possibility at the earliest stage.",
    question:
      "Did the individual intend to cause harm? Were the actions and the adverse consequence desired?",
    guidance: [
      "Intentional harm means the person deliberately set out to hurt someone",
      "This is extremely rare — do not confuse poor judgment with malicious intent",
      "An action is intentional if the harmful result is purposeful or substantially certain to occur",
      "Consider both action and inaction — deliberate failure to act can also constitute intentional harm",
      "Reckless behavior is NOT intentional harm — the person did not want a bad outcome",
      "If there is any doubt, the answer is likely No — proceed to the next test",
    ],
    options: [
      {
        label: "Yes — the individual deliberately intended to cause harm",
        value: "yes",
        description:
          "Intentional harm is outside the scope of Just Culture. Refer to law enforcement, HR, or regulatory bodies.",
        nextStepId: null,
        result: ALGORITHM_RESULTS.intentional_harm,
      },
      {
        label: "No — the individual did not intend to cause harm",
        value: "no",
        description: "Proceed to the Incapacity / Health Test.",
        nextStepId: "step_2",
      },
    ],
    educationalNote:
      "Intentional harm is vanishingly rare in healthcare and EMS. Most adverse events result from human error or behavioral choices made with good intentions. The purpose of this test is to identify and remove these rare cases before applying the Just Culture framework.",
  },

  // -----------------------------------------------------------------------
  // Step 2: TEST 2 — Incapacity / Physical & Mental Health Test
  // -----------------------------------------------------------------------
  {
    id: "step_2",
    stepNumber: 2,
    title: "Test 2: Incapacity / Health Test",
    description:
      "The Incapacity Test determines whether ill health, a physical or mental health condition, or substance use caused or contributed to the incident. The whole spectrum of impairment is considered — including prescription medications, fatigue-related conditions, mental health crises, and substance abuse.",
    question:
      "Does there appear to be evidence of ill health, a physical or mental health condition, or substance use that impaired the individual's performance?",
    guidance: [
      "Consider substance abuse, including alcohol, illegal substances, and inappropriate self-medication",
      "Consider physical health conditions — was there a known medical condition that could impair performance?",
      "Consider mental health conditions — was the individual in a mental health crisis, severe stress, or burnout?",
      "Consider fatigue — was the individual dangerously fatigued due to scheduling, overtime, or personal circumstances?",
      "Ask: Was the individual aware of their condition at the time?",
      "Ask: Did they realize the implications of their condition for patient safety?",
      "Ask: Did they take proper safeguards to protect patients?",
      "If the individual knowingly concealed an impairing condition, consider re-entering the algorithm at the Foresight Test",
    ],
    options: [
      {
        label: "Yes — ill health or substance impairment appears to have contributed",
        value: "yes",
        description:
          "The individual's performance was impaired. Follow the health/support pathway — occupational health referral, EAP, and adjusted duties as appropriate.",
        nextStepId: null,
        result: ALGORITHM_RESULTS.health_pathway,
      },
      {
        label: "No — incapacity was not a contributing factor",
        value: "no",
        description: "Proceed to the Foresight / Protocol Test.",
        nextStepId: "step_3",
      },
    ],
    educationalNote:
      "The Incapacity Test recognizes that impairment is not a behavioral choice — it requires a supportive, health-focused response. However, if an individual knowingly concealed a condition that put patients at risk, this itself may be an at-risk or reckless behavioral choice to evaluate under subsequent tests.",
  },

  // -----------------------------------------------------------------------
  // Step 3: TEST 3 — Foresight / Protocol Test
  // -----------------------------------------------------------------------
  {
    id: "step_3",
    stepNumber: 3,
    title: "Test 3: Foresight / Protocol Test",
    description:
      "The Foresight Test examines whether protocols and safe working practices were in place and were followed. It determines whether the incident arose because no protocol existed, the protocol was poor or conflicting, good protocols were misapplied, or the individual chose to ignore protocols.",
    question:
      "Were there clear, workable protocols or standards of practice in place, and were they followed?",
    guidance: [
      "Was there a protocol, policy, procedure, or standard of care that applied to this situation?",
      "If a protocol existed, was it clear, correct, up-to-date, and practically workable?",
      "Were there conflicting protocols or instructions?",
      "Was the protocol routinely violated by many staff (normalization of deviance)?",
      "If the individual followed all applicable rules and the outcome was still bad, the system designed the outcome",
      "The absence of a protocol is itself a system issue — not an individual failure",
    ],
    options: [
      {
        label:
          "No protocol existed, or the protocol was absent, unclear, conflicting, or unworkable",
        value: "no_protocol",
        description:
          "This is a system failure. The organization failed to provide adequate guidance. Focus on system redesign.",
        nextStepId: null,
        result: ALGORITHM_RESULTS.system_fix,
      },
      {
        label:
          "Protocols were in place and the individual followed them, but the outcome was still adverse",
        value: "followed",
        description:
          "The individual did what was expected. This is a system issue — the protocols themselves need improvement.",
        nextStepId: null,
        result: ALGORITHM_RESULTS.system_fix,
      },
      {
        label: "Clear, workable protocols were in place, but the individual departed from them",
        value: "departed",
        description:
          "The individual deviated from established practice. Proceed to determine if this was inadvertent or a conscious choice.",
        nextStepId: "step_4",
      },
    ],
    educationalNote:
      "If the individual did everything they were supposed to do and the outcome was still bad, the focus should be entirely on improving the system — not on the individual. What at first sight appears to be a workable protocol may be problematic in practice.",
  },

  // -----------------------------------------------------------------------
  // Step 4: Inadvertent vs. Conscious Deviation
  // -----------------------------------------------------------------------
  {
    id: "step_4",
    stepNumber: 4,
    title: "Inadvertent vs. Conscious Deviation",
    description:
      "This is the critical distinction between human error and a behavioral choice. Determine whether the individual's deviation was inadvertent (unintentional) or a conscious choice. Human errors are slips, lapses, and mistakes — not intentional deviations.",
    question:
      "Was the deviation inadvertent (unintentional), or did the individual make a conscious choice to deviate?",
    guidance: [
      "Inadvertent means the person intended to do the right thing but made a slip, lapse, or mistake",
      "A slip is an action-based error (grabbed the wrong item, transposed numbers)",
      "A lapse is a memory-based error (forgot a step in a procedure)",
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
          "This is a human error. The appropriate response is to console the individual and focus on system redesign to catch errors.",
        nextStepId: null,
        result: ALGORITHM_RESULTS.console,
      },
      {
        label:
          "Conscious choice — the individual deliberately chose to deviate from expected practice",
        value: "conscious",
        description:
          "The individual made a behavioral choice. Proceed to evaluate why with the Substitution Test.",
        nextStepId: "step_5",
      },
    ],
    educationalNote:
      "Most adverse events in healthcare are human errors — inadvertent actions by well-intentioned people. The system should be designed to catch these errors before they reach the patient. We do NOT choose to make errors — we are all fallible.",
  },

  // -----------------------------------------------------------------------
  // Step 5: TEST 4 — The Substitution Test
  // -----------------------------------------------------------------------
  {
    id: "step_5",
    stepNumber: 5,
    title: "Test 4: The Substitution Test",
    description:
      'The Substitution Test asks: "Would another individual, coming from the same professional group, possessing comparable qualifications and experience, behave in the same way in similar circumstances?" If yes, this points to a system/culture problem — not individual culpability.',
    question:
      "Would another individual with comparable training and experience, in the same situation, likely make the same behavioral choice?",
    guidance: [
      "Think of a typical competent professional in this role — not the best or the worst",
      "Consider all contextual factors: workload, time pressure, staffing, available information",
      "Is this deviation common practice? Do many people do it this way?",
      "Has the organization implicitly tolerated or encouraged this deviation?",
      "If most peers would do the same, it's a system/culture problem, not an individual problem",
      "Consider: has the organization created incentives for the at-risk behavior?",
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
        nextStepId: "step_6",
      },
    ],
    educationalNote:
      "The Substitution Test prevents scapegoating individuals for system failures. If the system is driving the behavior, fixing the individual won't fix the problem — it will just happen to someone else.",
  },

  // -----------------------------------------------------------------------
  // Step 6: System Contributing Factors
  // -----------------------------------------------------------------------
  {
    id: "step_6",
    stepNumber: 6,
    title: "System Contributing Factors",
    description:
      "Even when the substitution test indicates individual accountability, evaluate whether significant deficiencies in training, supervision, equipment, or system design contributed to the individual's behavioral choice. Consider work pressures, external pressures, environmental factors, and communication breakdowns.",
    question:
      "Were there significant deficiencies in training, supervision, or system design that contributed to the behavioral choice?",
    guidance: [
      "Was the individual adequately trained on the expected behavior?",
      "Was supervision appropriate for the individual's experience level?",
      "Did the system make it difficult to do the right thing?",
      "Were there conflicting pressures (time, production, competing priorities)?",
      "Was the expected behavior clearly communicated and reinforced?",
      "Were there deficiencies in equipment, technology, or the work environment?",
      "Consider staffing levels, fatigue factors, and communication systems",
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
        nextStepId: "step_7",
      },
    ],
  },

  // -----------------------------------------------------------------------
  // Step 7: Conscious Disregard of Risk
  // -----------------------------------------------------------------------
  {
    id: "step_7",
    stepNumber: 7,
    title: "Conscious Disregard of Risk",
    description:
      'This is the final determination: did the individual consciously disregard a substantial and unjustifiable risk? "Substantial" means the risk was significant. "Unjustifiable" means there was no reasonable benefit that outweighed the risk. Important: the question is about conscious disregard of a known RISK — not merely a policy violation.',
    question: "Did the individual consciously disregard a substantial and unjustifiable risk?",
    guidance: [
      "Did the individual KNOW the risk was significant?",
      "Was the risk substantial — not minor or theoretical?",
      "Was there any reasonable justification for taking the risk?",
      "Consider: did the person believe (even incorrectly) that the benefit outweighed the risk?",
      "Reckless behavior is rare — most deviations fall into the at-risk category",
      "Important: policy violations are often at-risk rather than reckless choices — the question is about risk, not rule-breaking",
      "Consider whether a pattern of unsafe acts exists",
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
      "Reckless behavior is rare in healthcare and EMS. Most people who deviate from expected practice do so because they don't appreciate the risk, or because system factors make the deviation attractive. The conscious disregard question is about RISK, not about the conscious disregard of a policy. Reserve discipline for true conscious disregard of substantial risk.",
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
    title: "The Four Sequential Tests",
    description:
      "The algorithm proceeds through four tests in order: Deliberate Harm, Incapacity/Health, Foresight/Protocol, and Substitution. Each test must be resolved before proceeding to the next.",
  },
  {
    title: "Three Behaviors, Three Responses",
    description:
      "Human Error → Console (support the person, fix the system). At-Risk Behavior → Coach (help them see the risk). Reckless Behavior → Discipline (proportional to behavior, not outcome).",
  },
  {
    title: "Systems Focus",
    description:
      "Even when individual behavior is at issue, always look for system factors. Systems should be designed to account for human fallibility. The further through the algorithm you travel, the more likely the underlying cause is a systems failure.",
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

// ---------------------------------------------------------------------------
// Three duties reference (David Marx framework)
// ---------------------------------------------------------------------------

export const THREE_DUTIES = [
  {
    title: "Duty to Produce an Outcome",
    description:
      "If the worker knows what is required of them and is able to do so, they should produce that outcome.",
  },
  {
    title: "Duty to Follow a Procedural Rule",
    description:
      "If the worker is aware of the proper procedure and there is nothing stopping them from performing it, they should follow the procedure.",
  },
  {
    title: "Duty to Avoid Causing Unjustifiable Risk or Harm",
    description:
      "Workers have a duty to avoid creating unjustifiable risk. Breach of this duty may warrant disciplinary action.",
  },
];
