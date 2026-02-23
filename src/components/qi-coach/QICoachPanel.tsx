"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Markdown from "react-markdown";
import {
  MessageSquare,
  X,
  Send,
  Loader2,
  Lightbulb,
  Sparkles,
  RotateCcw,
  ChevronDown,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { askQICoach, type QICoachMessage, type QICoachContext } from "@/actions/qi-coach";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QICoachPanelProps {
  context?: QICoachContext;
}

// ---------------------------------------------------------------------------
// Suggested questions — context-dependent
// ---------------------------------------------------------------------------

function getSuggestedQuestions(context?: QICoachContext): string[] {
  const general = [
    "What are the three fundamental questions of the IHI Model for Improvement?",
    "How do I interpret special cause variation on an SPC chart?",
    "What makes a good PDSA cycle?",
    "How do I choose the right measures for my QI project?",
  ];

  const campaign = [
    "How should I evaluate the progress of this campaign?",
    "What balancing measures should I consider?",
    "Our PDSA cycles aren't showing improvement. What should we try?",
    "How do I know when to adopt vs. adapt a change idea?",
  ];

  const metric = [
    "What does the variation in this metric tell me?",
    "When should I recalculate control limits?",
    "Is the current target appropriate for this metric?",
    "How do I distinguish signal from noise in this data?",
  ];

  if (context?.campaignName && context?.metricName) {
    return [...campaign.slice(0, 2), ...metric.slice(0, 2)];
  }
  if (context?.campaignName) return campaign;
  if (context?.metricName) return metric;
  return general;
}

// ---------------------------------------------------------------------------
// Quick Reference Cards
// ---------------------------------------------------------------------------

const QUICK_REFERENCES = [
  {
    title: "IHI Model for Improvement",
    content: `**Three Fundamental Questions:**
1. What are we trying to accomplish? (Aim)
2. How will we know that a change is an improvement? (Measures)
3. What changes can we make that will result in improvement? (Change Ideas)

Then test changes using **PDSA cycles** — small, rapid experiments.`,
  },
  {
    title: "PDSA Cycle Phases",
    content: `**Plan:** Define the change, predict the result, plan data collection
**Do:** Carry out the test on a small scale, document observations
**Study:** Compare results to predictions, analyze what happened
**Act:** Adopt (keep it), Adapt (modify & retest), or Abandon (try something else)

*Most improvements take 3-5 cycles.*`,
  },
  {
    title: "SPC Chart Rules",
    content: `**Special Cause signals** (process has changed):
- 1 point beyond control limits (3-sigma)
- 8+ consecutive points on one side of center line
- 6+ consecutive points trending up or down

**Common Cause** (normal variation):
- Random scatter within control limits
- Don't overreact to individual points!`,
  },
  {
    title: "Measure Types",
    content: `**Outcome Measures:** Did we achieve our aim?
*Example: Average on-scene time*

**Process Measures:** Are we implementing the change?
*Example: % crews trained on new protocol*

**Balancing Measures:** Are we causing harm elsewhere?
*Example: Patient complaint rate*

Keep it simple: 3-5 measures total.`,
  },
];

// ---------------------------------------------------------------------------
// Message bubble
// ---------------------------------------------------------------------------

function MessageBubble({ message }: { message: QICoachMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser ? "bg-nmh-teal text-white" : "bg-muted/60 text-foreground border"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-headings:text-sm">
            <Markdown>{message.content}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main QI Coach Panel Component
// ---------------------------------------------------------------------------

export function QICoachPanel({ context }: QICoachPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "reference">("chat");
  const [messages, setMessages] = useState<QICoachMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const suggestedQuestions = getSuggestedQuestions(context);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function handleSend(text?: string) {
    const messageText = text ?? input.trim();
    if (!messageText || isLoading) return;

    setInput("");
    setError(null);

    const userMessage: QICoachMessage = { role: "user", content: messageText };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    const result = await askQICoach(newMessages, context);

    if (result.success) {
      setMessages([...newMessages, { role: "assistant", content: result.reply }]);
    } else {
      setError(result.error);
    }

    setIsLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleReset() {
    setMessages([]);
    setError(null);
    setInput("");
  }

  // Context label for the header
  const contextLabel = context?.campaignName
    ? `Campaign: ${context.campaignName}`
    : context?.metricName
      ? `Metric: ${context.metricName}`
      : null;

  return (
    <>
      {/* Floating toggle button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-nmh-teal px-4 py-3 text-white shadow-lg hover:bg-nmh-teal/90 transition-all hover:scale-105 print:hidden"
          title="Open QI Coach"
        >
          <Sparkles className="h-5 w-5" />
          <span className="text-sm font-medium">QI Coach</span>
        </button>
      )}

      {/* Panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[420px] max-h-[600px] flex flex-col rounded-xl border bg-background shadow-2xl print:hidden">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-nmh-teal/5 rounded-t-xl">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="h-5 w-5 text-nmh-teal shrink-0" />
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-nmh-gray">QI Coach</h3>
                {contextLabel && (
                  <p className="text-[10px] text-muted-foreground truncate">{contextLabel}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Badge variant="outline" className="text-[10px] border-nmh-teal/30 text-nmh-teal">
                IHI
              </Badge>
              {messages.length > 0 && (
                <Button variant="ghost" size="sm" onClick={handleReset} title="New conversation">
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === "chat"
                  ? "text-nmh-teal border-b-2 border-nmh-teal"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Ask a Question
            </button>
            <button
              onClick={() => setActiveTab("reference")}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === "reference"
                  ? "text-nmh-teal border-b-2 border-nmh-teal"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              Quick Reference
            </button>
          </div>

          {/* Chat tab */}
          {activeTab === "chat" && (
            <>
              {/* Messages area */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px] max-h-[380px]">
                {messages.length === 0 ? (
                  <div className="space-y-4 py-2">
                    <div className="text-center space-y-2">
                      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-nmh-teal/10">
                        <Lightbulb className="h-5 w-5 text-nmh-teal" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Ask me anything about quality improvement, PDSA methodology, SPC charts, or
                        improvement strategies.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide px-1">
                        Suggested Questions
                      </p>
                      {suggestedQuestions.map((q, i) => (
                        <button
                          key={i}
                          onClick={() => handleSend(q)}
                          className="w-full text-left px-3 py-2 rounded-lg border text-xs text-muted-foreground hover:text-foreground hover:border-nmh-teal/40 hover:bg-nmh-teal/5 transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((msg, i) => (
                      <MessageBubble key={i} message={msg} />
                    ))}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-muted/60 border rounded-lg px-3 py-2 flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Thinking...
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

              {/* Input area */}
              <div className="border-t p-3">
                <div className="flex items-end gap-2">
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about QI best practices..."
                    className="min-h-[38px] max-h-[100px] resize-none text-sm"
                    rows={1}
                    disabled={isLoading}
                  />
                  <Button
                    onClick={() => handleSend()}
                    disabled={!input.trim() || isLoading}
                    size="sm"
                    className="bg-nmh-teal hover:bg-nmh-teal/90 shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                  Powered by Claude AI. Grounded in IHI Model for Improvement.
                </p>
              </div>
            </>
          )}

          {/* Quick Reference tab */}
          {activeTab === "reference" && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3 max-h-[440px]">
              {QUICK_REFERENCES.map((ref, i) => (
                <QuickReferenceCard key={i} title={ref.title} content={ref.content} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Quick Reference Card (collapsible)
// ---------------------------------------------------------------------------

function QuickReferenceCard({ title, content }: { title: string; content: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors text-left"
      >
        <span className="flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5 text-nmh-teal" />
          {title}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
            open ? "rotate-0" : "-rotate-90"
          }`}
        />
      </button>
      {open && (
        <div className="px-3 pb-3 border-t">
          <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1.5 prose-ul:my-1 prose-li:my-0.5 prose-headings:my-2 prose-headings:text-xs prose-strong:text-foreground text-xs text-muted-foreground pt-2">
            <Markdown>{content}</Markdown>
          </div>
        </div>
      )}
    </div>
  );
}
