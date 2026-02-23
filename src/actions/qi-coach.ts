"use server";

import { getAnthropicClient, isAiConfigured } from "@/lib/ai";

// ---------------------------------------------------------------------------
// QI Coach — AI-powered quality improvement coaching
//
// Uses the Claude API to answer questions about QI best practices, PDSA
// methodology, SPC interpretation, and improvement strategies. All responses
// are grounded in IHI Model for Improvement principles.
// ---------------------------------------------------------------------------

export interface QICoachMessage {
  role: "user" | "assistant";
  content: string;
}

export interface QICoachContext {
  campaignName?: string;
  campaignGoals?: string;
  campaignStatus?: string;
  metricName?: string;
  metricUnit?: string;
  metricTarget?: number | null;
  pdsaCycleCount?: number;
  completedCycles?: number;
  currentPhase?: string;
}

const SYSTEM_PROMPT = `You are the QI Coach, an expert quality improvement advisor built into the NMH EMS Operations Dashboard. Your role is to help EMS quality improvement professionals apply evidence-based QI methodology.

## Your Expertise
- IHI Model for Improvement (three fundamental questions + PDSA cycles)
- Statistical Process Control (SPC) chart interpretation
- Driver diagram design and improvement theory
- PDSA cycle methodology (Plan-Do-Study-Act)
- EMS-specific quality improvement (NASEMSO, NEMSQA, NHTSA standards)
- Measurement selection (outcome, process, balancing measures)
- Quality improvement culture and leadership

## Communication Style
- Be concise and actionable — EMS professionals are busy
- Use concrete EMS examples when possible (response times, cardiac care, medication errors, etc.)
- Reference IHI principles when relevant but don't be preachy
- When discussing SPC, explain in practical terms (when to react vs. when variation is normal)
- If the user asks about something outside QI methodology, politely redirect to QI topics
- Use bullet points and short paragraphs for readability
- When asked about PDSA cycles, always encourage starting small

## Guidelines
- Ground responses in established QI science — don't make up frameworks
- Be honest when a question is outside your expertise
- Encourage data-driven decisions over gut feelings
- Emphasize learning over blame (Just Culture principles)
- Remind users that most improvements take 3-5 PDSA cycles
- If the user seems stuck, suggest they simplify — smaller tests, fewer measures, clearer aims`;

function buildContextPrompt(context: QICoachContext): string {
  const parts: string[] = [];

  if (context.campaignName) {
    parts.push(`The user is currently viewing the QI campaign: "${context.campaignName}"`);
    if (context.campaignGoals) parts.push(`Campaign goals: ${context.campaignGoals}`);
    if (context.campaignStatus) parts.push(`Campaign status: ${context.campaignStatus}`);
    if (context.pdsaCycleCount !== undefined)
      parts.push(
        `PDSA cycles: ${context.pdsaCycleCount} total, ${context.completedCycles ?? 0} completed`
      );
  }

  if (context.metricName) {
    parts.push(`The user is viewing the metric: "${context.metricName}"`);
    if (context.metricUnit) parts.push(`Metric unit: ${context.metricUnit}`);
    if (context.metricTarget != null) parts.push(`Target: ${context.metricTarget}`);
  }

  if (parts.length === 0) return "";
  return `\n\n## Current Context\n${parts.join("\n")}`;
}

export async function askQICoach(
  messages: QICoachMessage[],
  context?: QICoachContext
): Promise<{ success: true; reply: string } | { success: false; error: string }> {
  if (!isAiConfigured()) {
    return {
      success: false,
      error:
        "AI is not configured. Set the ANTHROPIC_API_KEY environment variable to enable the QI Coach.",
    };
  }

  if (messages.length === 0) {
    return { success: false, error: "No messages provided." };
  }

  const lastMessage = messages[messages.length - 1];
  if (lastMessage.role !== "user") {
    return { success: false, error: "Last message must be from the user." };
  }

  try {
    const client = getAnthropicClient();

    const systemWithContext = SYSTEM_PROMPT + (context ? buildContextPrompt(context) : "");

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemWithContext,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return { success: false, error: "No text response received." };
    }

    return { success: true, reply: textContent.text };
  } catch (err) {
    console.error("[QI Coach] Error:", err);
    return {
      success: false,
      error: "Failed to get a response from the QI Coach. Please try again.",
    };
  }
}
