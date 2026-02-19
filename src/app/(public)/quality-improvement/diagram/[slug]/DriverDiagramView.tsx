"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3, ChevronDown, ChevronRight, RefreshCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PDSA_STATUS_LABELS, PDSA_STATUS_COLORS, PDSA_OUTCOME_LABELS } from "@/lib/constants";

interface PdsaCycleData {
  id: string;
  title: string;
  cycleNumber: number;
  status: string;
  outcome: string | null;
  metricName: string | null;
  planDescription: string | null;
  planPrediction: string | null;
  planDataCollection: string | null;
  planStartDate: string | null;
  doObservations: string | null;
  doStartDate: string | null;
  doEndDate: string | null;
  studyResults: string | null;
  studyLearnings: string | null;
  studyDate: string | null;
  actDecision: string | null;
  actNextSteps: string | null;
  actDate: string | null;
  updatedAt: string;
}

interface NodeData {
  id: string;
  parentId: string | null;
  type: "aim" | "primary" | "secondary" | "changeIdea";
  text: string;
  description: string | null;
  sortOrder: number;
  pdsaCycleCount: number;
  pdsaCycles: PdsaCycleData[];
}

interface TreeNode extends NodeData {
  children: TreeNode[];
}

const typeConfig: Record<
  string,
  { label: string; bgColor: string; borderColor: string; textColor: string }
> = {
  aim: {
    label: "Aim",
    bgColor: "bg-[#00b0ad]/10",
    borderColor: "border-[#00b0ad]",
    textColor: "text-[#00b0ad]",
  },
  primary: {
    label: "Primary Driver",
    bgColor: "bg-[#e04726]/10",
    borderColor: "border-[#e04726]",
    textColor: "text-[#e04726]",
  },
  secondary: {
    label: "Secondary Driver",
    bgColor: "bg-[#fcb526]/10",
    borderColor: "border-[#fcb526]",
    textColor: "text-[#fcb526]",
  },
  changeIdea: {
    label: "Change Idea",
    bgColor: "bg-[#4b4f54]/10",
    borderColor: "border-[#4b4f54]",
    textColor: "text-[#4b4f54]",
  },
};

const outcomeColors: Record<string, string> = {
  adopt: "bg-green-100 text-green-700",
  adapt: "bg-yellow-100 text-yellow-700",
  abandon: "bg-red-100 text-red-700",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildTree(nodes: NodeData[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const node of nodes) {
    nodeMap.set(node.id, { ...node, children: [] });
  }

  for (const node of nodes) {
    const treeNode = nodeMap.get(node.id)!;
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children.push(treeNode);
    } else {
      roots.push(treeNode);
    }
  }

  return roots;
}

function countDescendants(node: TreeNode): number {
  let count = 0;
  for (const child of node.children) {
    count += 1 + countDescendants(child);
  }
  return count;
}

function PhaseSection({
  label,
  color,
  content,
  date,
  extra,
}: {
  label: string;
  color: string;
  content: string | null;
  date: string | null;
  extra?: { label: string; value: string | null }[];
}) {
  if (!content && !date && !extra?.some((e) => e.value)) return null;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color }}>
          {label}
        </span>
        {date && <span className="text-xs text-muted-foreground">{formatDate(date)}</span>}
      </div>
      {content && <p className="text-sm text-foreground ml-4">{content}</p>}
      {extra?.map(
        (e) =>
          e.value && (
            <p key={e.label} className="text-xs text-muted-foreground ml-4">
              <span className="font-medium">{e.label}:</span> {e.value}
            </p>
          )
      )}
    </div>
  );
}

function PdsaCycleCard({ cycle }: { cycle: PdsaCycleData }) {
  const statusColor = PDSA_STATUS_COLORS[cycle.status] ?? "#4b4f54";

  return (
    <div className="border rounded-lg p-4 space-y-3">
      {/* Cycle header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{cycle.title}</span>
          <Badge variant="secondary" className="text-[10px]">
            Cycle #{cycle.cycleNumber}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge
            variant="secondary"
            className="text-[10px]"
            style={{
              backgroundColor: `${statusColor}15`,
              color: statusColor,
            }}
          >
            {PDSA_STATUS_LABELS[cycle.status] ?? cycle.status}
          </Badge>
          {cycle.outcome && (
            <Badge
              variant="secondary"
              className={`text-[10px] ${outcomeColors[cycle.outcome] ?? ""}`}
            >
              {PDSA_OUTCOME_LABELS[cycle.outcome] ?? cycle.outcome}
            </Badge>
          )}
        </div>
      </div>

      {cycle.metricName && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <BarChart3 className="h-3 w-3" />
          Metric: {cycle.metricName}
        </div>
      )}

      {/* Phase details */}
      <div className="space-y-3 pt-1">
        <PhaseSection
          label="Plan"
          color={PDSA_STATUS_COLORS.planning}
          content={cycle.planDescription}
          date={cycle.planStartDate}
          extra={[
            { label: "Prediction", value: cycle.planPrediction },
            { label: "Data Collection", value: cycle.planDataCollection },
          ]}
        />
        <PhaseSection
          label="Do"
          color={PDSA_STATUS_COLORS.doing}
          content={cycle.doObservations}
          date={cycle.doStartDate}
          extra={[
            {
              label: "End Date",
              value: cycle.doEndDate ? formatDate(cycle.doEndDate) : null,
            },
          ]}
        />
        <PhaseSection
          label="Study"
          color={PDSA_STATUS_COLORS.studying}
          content={cycle.studyResults}
          date={cycle.studyDate}
          extra={[{ label: "Learnings", value: cycle.studyLearnings }]}
        />
        <PhaseSection
          label="Act"
          color={PDSA_STATUS_COLORS.acting}
          content={cycle.actDecision}
          date={cycle.actDate}
          extra={[{ label: "Next Steps", value: cycle.actNextSteps }]}
        />
      </div>

      {/* Updated date */}
      <p className="text-[10px] text-muted-foreground text-right">
        Updated {formatDate(cycle.updatedAt)}
      </p>
    </div>
  );
}

function DiagramNode({
  node,
  depth,
  onChangeIdeaClick,
}: {
  node: TreeNode;
  depth: number;
  onChangeIdeaClick: (node: TreeNode) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const config = typeConfig[node.type] ?? typeConfig.changeIdea;
  const hasChildren = node.children.length > 0;
  const isCollapsible = hasChildren && node.type !== "changeIdea";
  const isClickableChangeIdea = node.type === "changeIdea" && node.pdsaCycleCount > 0;

  function handleClick() {
    if (isClickableChangeIdea) {
      onChangeIdeaClick(node);
    } else if (isCollapsible) {
      setCollapsed(!collapsed);
    }
  }

  return (
    <div>
      <Card
        className={`border-l-4 ${config.borderColor} ${config.bgColor} mb-2 ${
          isClickableChangeIdea
            ? "cursor-pointer hover:shadow-md transition-shadow ring-offset-background hover:ring-1 hover:ring-[#4b4f54]/30"
            : ""
        }`}
        onClick={isClickableChangeIdea ? handleClick : undefined}
      >
        <CardContent className="py-3 px-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                {isCollapsible && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 shrink-0 p-0 hover:bg-black/5"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCollapsed(!collapsed);
                    }}
                    aria-label={collapsed ? "Expand children" : "Collapse children"}
                  >
                    {collapsed ? (
                      <ChevronRight className={`h-3.5 w-3.5 ${config.textColor}`} />
                    ) : (
                      <ChevronDown className={`h-3.5 w-3.5 ${config.textColor}`} />
                    )}
                  </Button>
                )}
                <Badge
                  variant="outline"
                  className={`text-[10px] font-medium ${config.textColor} border-current shrink-0`}
                >
                  {config.label}
                </Badge>
                {node.type === "changeIdea" && node.pdsaCycleCount > 0 && (
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    <RefreshCcw className="h-2.5 w-2.5 mr-0.5" />
                    {node.pdsaCycleCount} PDSA
                  </Badge>
                )}
                {isCollapsible && collapsed && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] shrink-0 bg-gray-100 text-gray-500"
                  >
                    {countDescendants(node)} hidden
                  </Badge>
                )}
              </div>
              <p
                className={`font-medium ${node.type === "aim" ? "text-base" : "text-sm"} ${
                  isCollapsible ? "cursor-pointer" : ""
                }`}
                onClick={isCollapsible ? () => setCollapsed(!collapsed) : undefined}
              >
                {node.text}
              </p>
              {node.description && (
                <p className="text-xs text-muted-foreground mt-1">{node.description}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {hasChildren && !collapsed && (
        <div className="ml-6 md:ml-10 border-l-2 border-dashed border-gray-200 pl-4 md:pl-6">
          {node.children.map((child) => (
            <DiagramNode
              key={child.id}
              node={child}
              depth={depth + 1}
              onChangeIdeaClick={onChangeIdeaClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function DriverDiagramView({
  name,
  description,
  metricName,
  nodes,
}: {
  name: string;
  description: string | null;
  metricName: string | null;
  nodes: NodeData[];
}) {
  const tree = buildTree(nodes);
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/quality-improvement"
          className="inline-flex items-center gap-1.5 text-sm text-nmh-teal hover:underline mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Quality Improvement
        </Link>
        <h1 className="text-2xl font-bold text-nmh-gray">{name}</h1>
        {description && <p className="text-muted-foreground mt-1">{description}</p>}
        {metricName && (
          <Badge
            variant="outline"
            className="mt-2 text-xs bg-nmh-teal/5 text-nmh-teal border-nmh-teal/20"
          >
            <BarChart3 className="h-3 w-3 mr-1" />
            Linked Metric: {metricName}
          </Badge>
        )}
      </div>

      {/* Diagram */}
      {tree.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            This driver diagram has no nodes yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tree.map((node) => (
            <DiagramNode key={node.id} node={node} depth={0} onChangeIdeaClick={setSelectedNode} />
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 pt-4 border-t text-xs text-muted-foreground">
        <span className="font-medium">Legend:</span>
        {Object.entries(typeConfig).map(([key, config]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div
              className={`w-3 h-3 rounded-sm border-l-2 ${config.borderColor} ${config.bgColor}`}
            />
            <span>{config.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <RefreshCcw className="h-3 w-3" />
          <span>Click change ideas with PDSA badges to view details</span>
        </div>
      </div>

      {/* PDSA Cycle Detail Dialog */}
      <Dialog
        open={!!selectedNode}
        onOpenChange={(open) => {
          if (!open) setSelectedNode(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCcw className="h-4 w-4 text-[#4b4f54]" />
              {selectedNode?.text}
            </DialogTitle>
            <DialogDescription>
              {selectedNode?.pdsaCycleCount} PDSA cycle
              {selectedNode?.pdsaCycleCount !== 1 ? "s" : ""} linked to this change idea
            </DialogDescription>
          </DialogHeader>

          {selectedNode?.description && (
            <p className="text-sm text-muted-foreground -mt-2">{selectedNode.description}</p>
          )}

          {selectedNode && selectedNode.pdsaCycles.length === 1 ? (
            <div className="mt-2">
              <PdsaCycleCard cycle={selectedNode.pdsaCycles[0]} />
            </div>
          ) : selectedNode && selectedNode.pdsaCycles.length > 1 ? (
            <Tabs defaultValue={selectedNode.pdsaCycles[0].id} className="mt-2">
              <TabsList className="w-full">
                {selectedNode.pdsaCycles.map((cycle) => (
                  <TabsTrigger key={cycle.id} value={cycle.id}>
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: PDSA_STATUS_COLORS[cycle.status] ?? "#4b4f54" }}
                    />
                    Cycle #{cycle.cycleNumber}
                  </TabsTrigger>
                ))}
              </TabsList>
              {selectedNode.pdsaCycles.map((cycle) => (
                <TabsContent key={cycle.id} value={cycle.id}>
                  <PdsaCycleCard cycle={cycle} />
                </TabsContent>
              ))}
            </Tabs>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
