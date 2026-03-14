import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";

let _client: Anthropic | null = null;
let _resolvedKey: string | null = null;

/**
 * Resolve the Anthropic API key. The system environment may contain an empty
 * ANTHROPIC_API_KEY (e.g. from Claude Code), which prevents dotenv / Next.js
 * from overriding it with the .env value. Fall back to reading .env directly.
 */
function resolveApiKey(): string {
  // Return cached key if we already found a valid one
  if (_resolvedKey !== null && _resolvedKey.length > 0) return _resolvedKey;

  const envVal = process.env.ANTHROPIC_API_KEY;
  if (envVal && envVal.length > 0) {
    _resolvedKey = envVal;
    return _resolvedKey;
  }

  // Fallback: read .env file directly
  try {
    const envPath = join(process.cwd(), ".env");
    const content = readFileSync(envPath, "utf8");
    const match = content.match(/^ANTHROPIC_API_KEY=["']?([^"'\r\n]+)["']?/m);
    if (match?.[1]) {
      _resolvedKey = match[1];
      return _resolvedKey;
    }
  } catch {
    // .env file not found — that's fine
  }

  // Don't cache empty result — allow re-check on next request
  return "";
}

export function getAnthropicClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: resolveApiKey() });
  }
  return _client;
}

export function isAiConfigured(): boolean {
  return resolveApiKey().length > 0;
}
