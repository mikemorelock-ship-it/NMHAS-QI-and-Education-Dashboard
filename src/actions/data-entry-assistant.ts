"use server";

import { getAnthropicClient, isAiConfigured } from "@/lib/ai";
import { requireAdmin } from "@/lib/require-auth";
import {
  buildDataEntrySystemPrompt,
  parseAssistantResponse,
  type DataEntryContext,
  type ProposedEntry,
  type UnmatchedEntity,
} from "@/lib/data-entry-ai";
import { prisma } from "@/lib/db";
import type Anthropic from "@anthropic-ai/sdk";
type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
  /** Base64 data URIs for images (user messages only) */
  images?: string[];
  /** Proposed entries from AI (assistant messages only) */
  proposedEntries?: ProposedEntry[];
}

type AssistantResult =
  | {
      success: true;
      reply: string;
      proposedEntries: ProposedEntry[];
      unmatchedEntities: UnmatchedEntity[];
    }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Supported image MIME types for Claude Vision */
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

/**
 * Parse a base64 data URI into the media type and raw base64 data.
 * Returns null if the format is invalid or the MIME type is unsupported.
 */
function parseDataUri(dataUri: string): { mediaType: ImageMediaType; data: string } | null {
  const match = dataUri.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) return null;

  const mediaType = match[1];
  if (!ALLOWED_MIME_TYPES.has(mediaType)) return null;

  return {
    mediaType: mediaType as ImageMediaType,
    data: match[2],
  };
}

// ---------------------------------------------------------------------------
// Server action
// ---------------------------------------------------------------------------

export async function processDataEntryMessage(
  messages: AssistantMessage[],
  context: DataEntryContext
): Promise<AssistantResult> {
  // Permission check
  try {
    await requireAdmin("enter_metric_data");
  } catch {
    return { success: false, error: "Insufficient permissions." };
  }

  // Gate on AI configuration
  if (!isAiConfigured()) {
    return {
      success: false,
      error:
        "AI is not configured. Set the ANTHROPIC_API_KEY environment variable to enable the Data Entry Assistant.",
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
    const systemPrompt = buildDataEntrySystemPrompt(context);

    // Build Anthropic message array, converting images to content blocks
    const apiMessages: Anthropic.MessageParam[] = messages.map((msg) => {
      if (msg.role === "user" && msg.images && msg.images.length > 0) {
        const contentBlocks: Anthropic.ContentBlockParam[] = [];

        // Add images first
        for (const dataUri of msg.images) {
          const parsed = parseDataUri(dataUri);
          if (parsed) {
            contentBlocks.push({
              type: "image",
              source: {
                type: "base64",
                media_type: parsed.mediaType,
                data: parsed.data,
              },
            });
          }
        }

        // Add text content
        if (msg.content.trim()) {
          contentBlocks.push({ type: "text", text: msg.content });
        } else if (contentBlocks.length > 0) {
          contentBlocks.push({
            type: "text",
            text: "Please extract the metric data from this image.",
          });
        }

        return { role: "user" as const, content: contentBlocks };
      }

      return { role: msg.role, content: msg.content };
    });

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16384,
      system: systemPrompt,
      messages: apiMessages,
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return { success: false, error: "No text response received." };
    }

    const parsed = parseAssistantResponse(textContent.text, context);
    const wasTruncated = response.stop_reason === "max_tokens";

    return {
      success: true,
      reply: wasTruncated
        ? parsed.explanation +
          (parsed.entries.length > 0
            ? `\n\n⚠️ The response was cut short — I recovered ${parsed.entries.length} entries but there may be more. You can ask me to continue with the remaining data.`
            : "")
        : parsed.explanation,
      proposedEntries: parsed.entries,
      unmatchedEntities: parsed.unmatchedEntities,
    };
  } catch (err) {
    console.error("[Data Entry Assistant] Error:", err);
    return {
      success: false,
      error: "Failed to get a response from the Data Entry Assistant. Please try again.",
    };
  }
}

// ---------------------------------------------------------------------------
// Inline entity creation
// ---------------------------------------------------------------------------

export async function createRegionInline(
  name: string,
  divisionId: string
): Promise<
  | { success: true; region: { id: string; name: string; divisionId: string } }
  | { success: false; error: string }
> {
  let session;
  try {
    session = await requireAdmin("manage_departments");
  } catch {
    return { success: false, error: "Insufficient permissions." };
  }

  if (!name.trim()) {
    return { success: false, error: "Region name is required." };
  }

  try {
    const division = await prisma.division.findUnique({
      where: { id: divisionId },
      select: { id: true, name: true },
    });
    if (!division) {
      return { success: false, error: "Selected division does not exist." };
    }

    const region = await prisma.region.create({
      data: {
        name: name.trim(),
        divisionId,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "Region",
        entityId: region.id,
        details: `Created region "${name.trim()}" in division "${division.name}" (via Data Entry Assistant)`,
        actorId: session.userId,
        actorType: "admin",
      },
    });

    return {
      success: true,
      region: { id: region.id, name: region.name, divisionId: region.divisionId },
    };
  } catch (err) {
    console.error("[createRegionInline] Error:", err);
    return { success: false, error: "Failed to create region." };
  }
}
