"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowRight,
  GitBranchPlus,
  RefreshCcw,
  ListChecks,
  BarChart3,
  Calendar,
  User,
  Target,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_COLORS,
  PDSA_STATUS_COLORS,
  PDSA_OUTCOME_LABELS,
  ACTION_ITEM_STATUS_LABELS,
  ACTION_ITEM_STATUS_COLORS,
  ACTION_ITEM_PRIORITY_LABELS,
  ACTION_ITEM_PRIORITY_COLORS,
} from "@/lib/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CampaignInfo {
  name: string;
  slug: string;
  description: string | null;
  goals: string | null;
  status: string;
  ownerName: string | null;
  startDate: string | null;
  endDate: string | null;
}

interface DiagramInfo {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  metricName: string | null;
  nodeCount: number;
  pdsaCycleCount: number;
}

interface CycleInfo {
  id: string;
  title: string;
  cycleNumber: number;
  status: string;
  outcome: string | null;
  diagramName: string | null;
  diagramSlug: string | null;
  metricName: string | null;
  changeIdea: string | null;
}

interface ActionItemInfo {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  assigneeName: string | null;
}

interface Props {
  campaign: CampaignInfo;
  diagrams: DiagramInfo[];
  cycles: CycleInfo[];
  actionItems: ActionItemInfo[];
}

// ---------------------------------------------------------------------------
// PDSA Pipeline phases for visual grouping
// ---------------------------------------------------------------------------

const PIPELINE_PHASES = [
  { key: "planning", label: "Plan" },
  { key: "doing", label: "Do" },
  { key: "studying", label: "Study" },
  { key: "acting", label: "Act" },
  { key: "completed", label: "Done" },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CampaignDetailView({ campaign, diagrams, cycles, actionItems }: Props) {
  const statusColor = CAMPAIGN_STATUS_COLORS[campaign.status] ?? "#4b4f54";

  // Group cycles by pipeline phase
  const cyclesByPhase = PIPELINE_PHASES.map((phase) => ({
    ...phase,
    cycles: cycles.filter((c) =>
      phase.key === "completed"
        ? c.status === "completed" || c.status === "abandoned"
        : c.status === phase.key
    ),
  }));

  const completedCycles = cycles.filter((c) => c.status === "completed").length;
  const totalCycles = cycles.length;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-8">
      {/* Breadcrumb */}
      <Link
        href="/quality-improvement"
        className="text-sm text-muted-foreground hover:text-nmh-teal flex items-center gap-1"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to QI Tools
      </Link>

      {/* Campaign Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <Target className="h-6 w-6 text-nmh-teal" />
            <h1 className="text-2xl font-bold text-nmh-gray">{campaign.name}</h1>
            <Badge
              variant="secondary"
              style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
            >
              {CAMPAIGN_STATUS_LABELS[campaign.status] ?? campaign.status}
            </Badge>
          </div>
          <Link href={`/quality-improvement/campaign/${campaign.slug}/report`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <FileText className="h-4 w-4" /> Campaign Report
            </Button>
          </Link>
        </div>

        {campaign.description && <p className="text-muted-foreground">{campaign.description}</p>}

        <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
          {campaign.ownerName && (
            <span className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {campaign.ownerName}
            </span>
          )}
          {(campaign.startDate || campaign.endDate) && (
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {campaign.startDate ?? "—"} → {campaign.endDate ?? "—"}
            </span>
          )}
        </div>

        {campaign.goals && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Goals & Objectives</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm whitespace-pre-line">{campaign.goals}</div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-nmh-teal">{diagrams.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Driver Diagrams</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-nmh-orange">{totalCycles}</div>
            <p className="text-xs text-muted-foreground mt-1">PDSA Cycles</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-nmh-gray">{completedCycles}</div>
            <p className="text-xs text-muted-foreground mt-1">Completed Cycles</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-nmh-teal">
              {actionItems.filter((a) => a.status !== "completed").length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Open Actions</p>
          </CardContent>
        </Card>
      </div>

      {/* Driver Diagrams */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <GitBranchPlus className="h-5 w-5 text-nmh-teal" />
          <h2 className="text-lg font-semibold text-nmh-gray">Driver Diagrams</h2>
        </div>
        {diagrams.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              No driver diagrams linked to this campaign yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {diagrams.map((d) => (
              <Link key={d.id} href={`/quality-improvement/diagram/${d.slug}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="truncate">{d.name}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {d.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{d.description}</p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      {d.metricName && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-nmh-teal/5 text-nmh-teal border-nmh-teal/20"
                        >
                          <BarChart3 className="h-3 w-3 mr-1" />
                          {d.metricName}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {d.nodeCount} nodes
                      </Badge>
                      {d.pdsaCycleCount > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          <RefreshCcw className="h-3 w-3 mr-1" />
                          {d.pdsaCycleCount} cycles
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* PDSA Cycle Pipeline */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <RefreshCcw className="h-5 w-5 text-nmh-orange" />
          <h2 className="text-lg font-semibold text-nmh-gray">PDSA Cycle Pipeline</h2>
        </div>
        {cycles.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              No PDSA cycles in this campaign yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {cyclesByPhase.map((phase) => {
              const phaseColor = PDSA_STATUS_COLORS[phase.key] ?? "#4b4f54";
              return (
                <div key={phase.key}>
                  <div
                    className="text-xs font-semibold mb-2 px-2 py-1 rounded-t-md text-center"
                    style={{ backgroundColor: `${phaseColor}20`, color: phaseColor }}
                  >
                    {phase.label} ({phase.cycles.length})
                  </div>
                  <div className="space-y-2 min-h-[60px]">
                    {phase.cycles.length === 0 ? (
                      <div className="text-xs text-muted-foreground/50 text-center py-4">—</div>
                    ) : (
                      phase.cycles.map((c) => (
                        <Card key={c.id} className="shadow-sm">
                          <CardContent className="p-3 space-y-1">
                            <p className="text-sm font-medium leading-tight">{c.title}</p>
                            <p className="text-xs text-muted-foreground">Cycle #{c.cycleNumber}</p>
                            {c.changeIdea && (
                              <p className="text-xs text-muted-foreground truncate">
                                → {c.changeIdea}
                              </p>
                            )}
                            {c.outcome && (
                              <Badge variant="outline" className="text-xs mt-1">
                                {PDSA_OUTCOME_LABELS[c.outcome] ?? c.outcome}
                              </Badge>
                            )}
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Action Items */}
      {actionItems.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <ListChecks className="h-5 w-5 text-nmh-teal" />
            <h2 className="text-lg font-semibold text-nmh-gray">Action Items</h2>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {actionItems.map((a) => {
                  const pColor = ACTION_ITEM_PRIORITY_COLORS[a.priority] ?? "#4b4f54";
                  const sColor = ACTION_ITEM_STATUS_COLORS[a.status] ?? "#4b4f54";
                  return (
                    <div
                      key={a.id}
                      className={`flex items-center gap-3 px-4 py-3 ${a.status === "completed" ? "opacity-60" : ""}`}
                    >
                      <CheckCircle2
                        className={`h-5 w-5 shrink-0 ${a.status === "completed" ? "text-green-600" : "text-muted-foreground/30"}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium ${a.status === "completed" ? "line-through" : ""}`}
                        >
                          {a.title}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          {a.assigneeName && <span>{a.assigneeName}</span>}
                          {a.dueDate && <span>Due {a.dueDate}</span>}
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        style={{ backgroundColor: `${pColor}20`, color: pColor }}
                        className="text-xs shrink-0"
                      >
                        {ACTION_ITEM_PRIORITY_LABELS[a.priority] ?? a.priority}
                      </Badge>
                      <Badge
                        variant="secondary"
                        style={{ backgroundColor: `${sColor}20`, color: sColor }}
                        className="text-xs shrink-0"
                      >
                        {ACTION_ITEM_STATUS_LABELS[a.status] ?? a.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
