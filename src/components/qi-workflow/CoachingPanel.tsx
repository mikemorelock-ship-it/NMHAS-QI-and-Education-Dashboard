"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Lightbulb, HelpCircle, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CoachingStep, PhaseCoaching } from "@/lib/qi-coaching-content";

// ---------------------------------------------------------------------------
// CoachingPanel — collapsible sidebar for IHI coaching content
// ---------------------------------------------------------------------------

interface CoachingPanelProps {
  step: CoachingStep | PhaseCoaching;
  /** Whether the panel starts expanded (default true on lg+, false on mobile) */
  defaultExpanded?: boolean;
}

export function CoachingPanel({ step, defaultExpanded = true }: CoachingPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const hasExamples = "examples" in step && step.examples.length > 0;

  return (
    <Card className="border-nmh-teal/30 bg-nmh-teal/5">
      {/* Collapsible header */}
      <CardHeader
        className="cursor-pointer select-none pb-2"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-nmh-teal shrink-0" />
          <CardTitle className="text-sm font-semibold text-nmh-teal flex-1">QI Coaching</CardTitle>
          <Badge variant="outline" className="text-xs border-nmh-teal/30 text-nmh-teal">
            IHI
          </Badge>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 pt-0 text-sm">
          {/* Description */}
          <p className="text-muted-foreground leading-relaxed">{step.description}</p>

          {/* Tips */}
          {step.tips.length > 0 && (
            <CoachingSection icon={<Lightbulb className="h-3.5 w-3.5" />} title="Tips">
              <ul className="space-y-1.5">
                {step.tips.map((tip, i) => (
                  <li key={i} className="text-muted-foreground leading-snug flex gap-2">
                    <span className="text-nmh-teal mt-0.5 shrink-0">&#8226;</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </CoachingSection>
          )}

          {/* Guiding Questions */}
          {step.guidingQuestions.length > 0 && (
            <CoachingSection
              icon={<HelpCircle className="h-3.5 w-3.5" />}
              title="Guiding Questions"
            >
              <ul className="space-y-1.5">
                {step.guidingQuestions.map((q, i) => (
                  <li key={i} className="text-muted-foreground leading-snug flex gap-2">
                    <span className="text-amber-600 mt-0.5 shrink-0">?</span>
                    <span className="italic">{q}</span>
                  </li>
                ))}
              </ul>
            </CoachingSection>
          )}

          {/* Examples (only for CoachingStep, not PhaseCoaching) */}
          {hasExamples && (
            <CoachingSection icon={<BookOpen className="h-3.5 w-3.5" />} title="Examples">
              <ul className="space-y-2">
                {(step as CoachingStep).examples.map((ex, i) => (
                  <li
                    key={i}
                    className="text-muted-foreground leading-snug bg-background/60 rounded-md p-2 border border-border/50 text-xs"
                  >
                    {ex}
                  </li>
                ))}
              </ul>
            </CoachingSection>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Collapsible sub-section within the coaching panel
// ---------------------------------------------------------------------------

function CoachingSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs font-medium text-foreground/80 hover:text-foreground transition-colors mb-1.5 w-full text-left"
      >
        {icon}
        {title}
        {open ? (
          <ChevronDown className="h-3 w-3 ml-auto" />
        ) : (
          <ChevronRight className="h-3 w-3 ml-auto" />
        )}
      </button>
      {open && <div className="pl-5">{children}</div>}
    </div>
  );
}
