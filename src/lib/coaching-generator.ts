import { getAnthropicClient } from "@/lib/ai";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GenerationParams {
  documentText: string;
  documentTitle: string;
  categoryName: string;
  categoryDescription: string | null;
  activityType: "reading" | "quiz" | "scenario" | "reflection";
  difficulty: "basic" | "intermediate" | "advanced";
  additionalInstructions?: string;
}

export interface GeneratedActivity {
  title: string;
  description: string;
  content: string;
  estimatedMins: number;
}

export interface GenerationResult {
  activity: GeneratedActivity;
  prompt: string; // stored for reproducibility
}

// ---------------------------------------------------------------------------
// Document Chunking
// ---------------------------------------------------------------------------

const MAX_DOCUMENT_CHARS = 30000;

function prepareDocumentContext(text: string): string {
  if (text.length <= MAX_DOCUMENT_CHARS) return text;

  const headSize = 25000;
  const tailSize = 5000;
  const head = text.slice(0, headSize);
  const tail = text.slice(-tailSize);

  return head + "\n\n[... DOCUMENT TRUNCATED — middle section omitted for length ...]\n\n" + tail;
}

// ---------------------------------------------------------------------------
// Prompt Construction
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert EMS (Emergency Medical Services) field training curriculum developer. Your role is to create high-quality coaching activities for EMS trainees based on organizational documents, protocols, and resources.

Your coaching activities should:
- Be grounded in the specific content of the source document provided
- Reference specific sections, protocols, procedures, and details from the document
- Be appropriate for the specified difficulty level
- Use professional EMS terminology accurately
- Include practical, real-world applications
- Be engaging and educational

You MUST respond with valid JSON matching the exact schema specified in the user prompt. Do not include any text outside the JSON object.`;

function buildActivityPrompt(params: GenerationParams): string {
  const docContext = prepareDocumentContext(params.documentText);

  const typeInstructions: Record<string, string> = {
    reading: `Create a "reading" activity — an educational text that teaches the trainee about the topic.
The "content" field should be well-structured markdown with:
- Clear headings and subheadings
- Key concepts highlighted in bold
- Bullet points for important lists
- References to specific sections/pages from the source document
- A "Key Takeaways" section at the end`,

    reflection: `Create a "reflection" activity — a guided self-assessment prompt.
The "content" field should be markdown containing:
- Context setting (1-2 paragraphs referencing the source document)
- 3-5 specific reflection questions that prompt the trainee to think critically
- Questions should relate directly to their field experience and the document content
- Include prompts that ask them to connect theory to practice`,

    quiz: `Create a "quiz" activity — a knowledge assessment.
The "content" field should be a JSON string (escaped properly within the outer JSON) with this structure:
{
  "questions": [
    {
      "question": "Question text referencing document content",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correctIndex": 0,
      "explanation": "Why this answer is correct, citing the source document"
    }
  ]
}
Include 5-8 questions for basic, 8-10 for intermediate, 10-12 for advanced difficulty.
Questions should directly test knowledge from the source document.`,

    scenario: `Create a "scenario" activity — a realistic clinical/field scenario.
The "content" field should be markdown containing:
- A detailed scenario setup (patient presentation, scene description, dispatch info)
- The scenario should be based on protocols/procedures from the source document
- Include 3-5 decision points where the trainee must choose an action
- For each decision point, describe the correct approach referencing the source document
- End with a debrief section summarizing learning objectives`,
  };

  const difficultyGuidelines: Record<string, string> = {
    basic:
      "Basic difficulty: Cover fundamental concepts. Assume the trainee is new and needs clear, straightforward content. Focus on core knowledge and standard procedures.",
    intermediate:
      "Intermediate difficulty: Build on foundational knowledge. Include nuanced scenarios, edge cases, or integration of multiple concepts. Assume the trainee has some field experience.",
    advanced:
      "Advanced difficulty: Challenge experienced trainees with complex, multi-factor scenarios. Include critical thinking elements, rare presentations, and inter-agency coordination. Expect detailed clinical reasoning.",
  };

  let prompt = `## Source Document: "${params.documentTitle}"

${docContext}

---

## Generation Instructions

**Category:** ${params.categoryName}${params.categoryDescription ? ` — ${params.categoryDescription}` : ""}
**Activity Type:** ${params.activityType}
**Difficulty:** ${params.difficulty}

${difficultyGuidelines[params.difficulty]}

${typeInstructions[params.activityType]}`;

  if (params.additionalInstructions) {
    prompt += `\n\n**Additional Instructions from Admin:**\n${params.additionalInstructions}`;
  }

  prompt += `\n\n## Required JSON Response Format

Respond with ONLY a JSON object (no markdown code fence, no extra text):
{
  "title": "Short, descriptive activity title (max 80 chars)",
  "description": "One-sentence summary of what the trainee will learn (max 200 chars)",
  "content": "The full activity content as described above (markdown string or JSON string for quizzes)",
  "estimatedMins": <number between 5 and 30>
}`;

  return prompt;
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export async function generateCoachingActivity(
  params: GenerationParams
): Promise<GenerationResult> {
  const client = getAnthropicClient();
  const userPrompt = buildActivityPrompt(params);

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  // Extract text from response
  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from AI");
  }

  // Parse JSON response — strip markdown code fences if present
  let jsonText = textBlock.text.trim();
  if (jsonText.startsWith("```")) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const parsed = JSON.parse(jsonText) as GeneratedActivity;

  // Validate required fields
  if (!parsed.title || !parsed.content) {
    throw new Error("AI response missing required fields (title, content)");
  }

  return {
    activity: {
      title: parsed.title,
      description: parsed.description || "",
      content: parsed.content,
      estimatedMins: parsed.estimatedMins || 10,
    },
    prompt: userPrompt,
  };
}

// ---------------------------------------------------------------------------
// Batch Generation
// ---------------------------------------------------------------------------

export interface BatchItem {
  categoryId: string;
  categoryName: string;
  categoryDescription: string | null;
  activityType: "reading" | "quiz" | "scenario" | "reflection";
  difficulty: "basic" | "intermediate" | "advanced";
}

export interface BatchResult {
  item: BatchItem;
  result?: GenerationResult;
  error?: string;
}

export async function generateBatchCoachingActivities(
  documentText: string,
  documentTitle: string,
  items: BatchItem[],
  additionalInstructions?: string
): Promise<BatchResult[]> {
  const results: BatchResult[] = [];

  // Generate sequentially to avoid rate limits
  for (const item of items) {
    try {
      const result = await generateCoachingActivity({
        documentText,
        documentTitle,
        categoryName: item.categoryName,
        categoryDescription: item.categoryDescription,
        activityType: item.activityType,
        difficulty: item.difficulty,
        additionalInstructions,
      });
      results.push({ item, result });
    } catch (err) {
      results.push({
        item,
        error: err instanceof Error ? err.message : "Generation failed",
      });
    }
  }

  return results;
}
