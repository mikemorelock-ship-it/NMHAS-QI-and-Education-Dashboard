"use client";

import { useState } from "react";
import { ArrowLeft, Wand2, LayoutGrid, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GuidedWizard } from "@/components/qi-workflow/GuidedWizard";
import { FlexibleCanvas } from "@/components/qi-workflow/FlexibleCanvas";
import { QuickCapture } from "@/components/qi-workflow/QuickCapture";
import type {
  CampaignSummary,
  DiagramSummary,
  PdsaCycleSummary,
  UserOption,
  MetricOption,
  ChangeIdeaOption,
  DepartmentOption,
} from "./page";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WorkflowMode = "select" | "guided" | "flexible" | "quick";

interface QiWorkflowClientProps {
  campaigns: CampaignSummary[];
  diagrams: DiagramSummary[];
  pdsaCycles: PdsaCycleSummary[];
  users: UserOption[];
  metrics: MetricOption[];
  changeIdeas: ChangeIdeaOption[];
  departments: DepartmentOption[];
}

// ---------------------------------------------------------------------------
// Mode cards configuration
// ---------------------------------------------------------------------------

const MODES = [
  {
    id: "guided" as const,
    icon: Wand2,
    title: "Campaign Wizard",
    subtitle: "Guided",
    description:
      "Step-by-step guided setup following the IHI Model for Improvement. Best for new QI practitioners and formal improvement projects.",
    color: "text-nmh-teal",
    bgColor: "bg-nmh-teal/10 hover:bg-nmh-teal/20",
    borderColor: "border-nmh-teal/30",
  },
  {
    id: "flexible" as const,
    icon: LayoutGrid,
    title: "Connected Canvas",
    subtitle: "Flexible",
    description:
      "View all campaigns, find gaps, and connect orphaned items. Best for experienced QI leads managing multiple initiatives.",
    color: "text-blue-600",
    bgColor: "bg-blue-50 hover:bg-blue-100",
    borderColor: "border-blue-200",
  },
  {
    id: "quick" as const,
    icon: Zap,
    title: "Quick Capture",
    subtitle: "Standalone",
    description:
      "Create standalone campaigns, diagrams, or PDSA cycles with optional linking. Best for rapid tests and ad-hoc improvements.",
    color: "text-amber-600",
    bgColor: "bg-amber-50 hover:bg-amber-100",
    borderColor: "border-amber-200",
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QiWorkflowClient({
  campaigns,
  diagrams,
  pdsaCycles,
  users,
  metrics,
  changeIdeas,
  departments,
}: QiWorkflowClientProps) {
  const [mode, setMode] = useState<WorkflowMode>("select");

  // Shared back button
  const backButton = (
    <Button variant="ghost" size="sm" onClick={() => setMode("select")} className="mb-4">
      <ArrowLeft className="h-4 w-4 mr-2" />
      Back to QI Workflow
    </Button>
  );

  // Mode selector
  if (mode === "select") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">QI Workflow</h1>
          <p className="text-muted-foreground mt-1">
            Choose a workflow mode to build, manage, or explore your quality improvement
            initiatives.
          </p>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Campaigns" value={campaigns.length} />
          <StatCard label="Driver Diagrams" value={diagrams.length} />
          <StatCard label="PDSA Cycles" value={pdsaCycles.length} />
          <StatCard
            label="Avg. Completeness"
            value={
              campaigns.length > 0
                ? `${Math.round(campaigns.reduce((s, c) => s + c.completeness, 0) / campaigns.length)}%`
                : "—"
            }
          />
        </div>

        {/* Mode cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {MODES.map((m) => (
            <Card
              key={m.id}
              className={`cursor-pointer transition-all hover:shadow-md ${m.borderColor}`}
              onClick={() => setMode(m.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg ${m.bgColor}`}>
                    <m.icon className={`h-6 w-6 ${m.color}`} />
                  </div>
                  <div>
                    <p className={`text-xs font-medium uppercase tracking-wider ${m.color}`}>
                      {m.subtitle}
                    </p>
                    <CardTitle className="text-lg">{m.title}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">{m.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Render selected mode
  return (
    <div>
      {backButton}

      {mode === "guided" && (
        <GuidedWizard
          users={users}
          metrics={metrics}
          campaigns={campaigns}
          diagrams={diagrams}
          changeIdeas={changeIdeas}
          departments={departments}
        />
      )}

      {mode === "flexible" && (
        <FlexibleCanvas
          campaigns={campaigns}
          diagrams={diagrams}
          pdsaCycles={pdsaCycles}
          users={users}
        />
      )}

      {mode === "quick" && (
        <QuickCapture
          campaigns={campaigns}
          diagrams={diagrams}
          users={users}
          metrics={metrics}
          changeIdeas={changeIdeas}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card helper
// ---------------------------------------------------------------------------

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </Card>
  );
}
