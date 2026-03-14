"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Markdown from "react-markdown";
import { Send, Loader2, Paperclip, X, RotateCcw, ImageIcon, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { processDataEntryMessage, type AssistantMessage } from "@/actions/data-entry-assistant";
import type { DataEntryContext } from "@/lib/data-entry-ai";
import type { ProposedEntry } from "@/lib/data-entry-ai";
import { ProposedEntriesReview } from "./ProposedEntriesReview";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DataEntryAssistantProps {
  context: DataEntryContext;
}

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  images?: string[];
  proposedEntries?: ProposedEntry[];
  savedCount?: number;
}

// ---------------------------------------------------------------------------
// Suggested prompts
// ---------------------------------------------------------------------------

const SUGGESTED_PROMPTS = [
  "Upload a screenshot of your monthly report",
  "Enter cardiac arrest data for this month",
  "I have STEMI numbers to enter for all regions",
  "Help me update last month's metrics",
];

// ---------------------------------------------------------------------------
// Image thumbnail
// ---------------------------------------------------------------------------

function ImageThumbnail({ src, onRemove }: { src: string; onRemove?: () => void }) {
  return (
    <div className="relative inline-block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Upload preview" className="h-16 w-16 object-cover rounded border" />
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full p-0.5"
          title="Remove image"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message bubble
// ---------------------------------------------------------------------------

function MessageBubble({
  message,
  context,
  onSaved,
}: {
  message: DisplayMessage;
  context: DataEntryContext;
  onSaved: (msgIndex: number, count: number) => void;
  msgIndex: number;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
          isUser ? "bg-nmh-teal text-white" : "bg-muted/60 text-foreground border"
        }`}
      >
        {/* User images */}
        {isUser && message.images && message.images.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {message.images.map((img, i) => (
              <ImageThumbnail key={i} src={img} />
            ))}
          </div>
        )}

        {/* Text content */}
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-headings:text-sm">
            <Markdown>{message.content}</Markdown>
          </div>
        )}

        {/* Proposed entries review */}
        {!isUser &&
          message.proposedEntries &&
          message.proposedEntries.length > 0 &&
          !message.savedCount && (
            <div className="mt-3 pt-3 border-t">
              <ProposedEntriesReview
                entries={message.proposedEntries}
                onSaved={(count) => {
                  // Find this message index and notify parent
                  onSaved(-1, count); // will be resolved by parent
                }}
              />
            </div>
          )}

        {/* Saved confirmation */}
        {!isUser && message.savedCount && message.savedCount > 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-green-700 bg-green-50 rounded px-2 py-1">
            <Sparkles className="h-3 w-3" />
            {message.savedCount} {message.savedCount === 1 ? "entry" : "entries"} saved
            successfully!
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DataEntryAssistant({ context }: DataEntryAssistantProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Handle image file selection
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 10 * 1024 * 1024) {
        setError("Image must be under 10MB.");
        continue;
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setPendingImages((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    }

    // Reset the input so the same file can be selected again
    e.target.value = "";
  }

  // Handle paste (for clipboard screenshots)
  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (!item.type.startsWith("image/")) continue;
      e.preventDefault();

      const file = item.getAsFile();
      if (!file) continue;

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setPendingImages((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    }
  }

  // Remove a pending image
  function removePendingImage(index: number) {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  }

  // Send message
  async function handleSend(text?: string) {
    const messageText = text ?? input.trim();
    if ((!messageText && pendingImages.length === 0) || isLoading) return;

    setInput("");
    setError(null);

    const userMessage: DisplayMessage = {
      role: "user",
      content: messageText || "Please extract the metric data from this image.",
      images: pendingImages.length > 0 ? [...pendingImages] : undefined,
    };
    setPendingImages([]);

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    // Build the server action message array
    const actionMessages: AssistantMessage[] = newMessages.map((m) => ({
      role: m.role,
      content: m.content,
      images: m.images,
      proposedEntries: m.proposedEntries,
    }));

    const result = await processDataEntryMessage(actionMessages, context);

    if (result.success) {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: result.reply,
          proposedEntries: result.proposedEntries.length > 0 ? result.proposedEntries : undefined,
        },
      ]);
    } else {
      setError(result.error);
    }

    setIsLoading(false);
  }

  // Handle keyboard shortcuts
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Reset conversation
  function handleReset() {
    setMessages([]);
    setError(null);
    setInput("");
    setPendingImages([]);
  }

  // Handle save callback from ProposedEntriesReview
  function handleEntrySaved(_msgIndex: number, count: number) {
    // Mark the last assistant message as saved
    setMessages((prev) => {
      const updated = [...prev];
      // Find the last assistant message with proposed entries
      for (let i = updated.length - 1; i >= 0; i--) {
        if (
          updated[i].role === "assistant" &&
          updated[i].proposedEntries &&
          !updated[i].savedCount
        ) {
          updated[i] = { ...updated[i], savedCount: count };
          break;
        }
      }
      return updated;
    });
  }

  return (
    <div className="flex flex-col h-[500px] border rounded-lg bg-background">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-nmh-teal/5 rounded-t-lg">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-nmh-teal" />
          <div>
            <h3 className="text-sm font-semibold text-nmh-gray">Data Entry Assistant</h3>
            <p className="text-[10px] text-muted-foreground">
              Upload screenshots or describe your data in plain English
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={handleReset} title="New conversation">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="space-y-4 py-4">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-nmh-teal/10">
                <ImageIcon className="h-6 w-6 text-nmh-teal" />
              </div>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Upload a screenshot of your Excel report or paper tally, or just describe the data
                you want to enter.
              </p>
            </div>

            <div className="space-y-1.5 max-w-md mx-auto">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide px-1">
                Try saying...
              </p>
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(prompt)}
                  className="w-full text-left px-3 py-2 rounded-lg border text-xs text-muted-foreground hover:text-foreground hover:border-nmh-teal/40 hover:bg-nmh-teal/5 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <MessageBubble
                key={i}
                message={msg}
                context={context}
                onSaved={handleEntrySaved}
                msgIndex={i}
              />
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted/60 border rounded-lg px-3 py-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Analyzing your data...
                </div>
              </div>
            )}
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Pending images preview */}
      {pendingImages.length > 0 && (
        <div className="px-4 py-2 border-t bg-muted/30 flex gap-2 flex-wrap">
          {pendingImages.map((img, i) => (
            <ImageThumbnail key={i} src={img} onRemove={() => removePendingImage(i)} />
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Attachment button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            title="Upload an image"
            className="shrink-0"
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          {/* Text input */}
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Describe your data or paste a screenshot (Ctrl+V)..."
            className="min-h-[38px] max-h-[100px] resize-none text-sm"
            rows={1}
            disabled={isLoading}
          />

          {/* Send button */}
          <Button
            onClick={() => handleSend()}
            disabled={(!input.trim() && pendingImages.length === 0) || isLoading}
            size="sm"
            className="bg-nmh-teal hover:bg-nmh-teal/90 shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
          Powered by Claude AI. Always review proposed entries before saving.
        </p>
      </div>
    </div>
  );
}
