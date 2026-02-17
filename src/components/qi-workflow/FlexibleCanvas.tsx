"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Target,
  GitBranchPlus,
  RefreshCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Link2,
  ExternalLink,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { assignDiagramToCampaign } from "@/actions/campaigns";
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_COLORS,
} from "@/lib/constants";
import type {
  CampaignSummary,
  DiagramSummary,
  PdsaCycleSummary,
  UserOption,
} from "@/app/(admin)/admin/qi-workflow/page";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FlexibleCanvasProps {
  campaigns: CampaignSummary[];
  diagrams: DiagramSummary[];
  pdsaCycles: PdsaCycleSummary[];
  users: UserOption[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FlexibleCanvas({
  campaigns,
  diagrams,
  pdsaCycles,
}: FlexibleCanvasProps) {
  const [isPending, startTransition] = useTransition();
  const [linkDiagramId, setLinkDiagramId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Identify orphans
  const orphanedDiagrams = diagrams.filter((d) => !d.campaignId);
  const orphanedPdsa = pdsaCycles.filter((p) => !p.driverDiagramId);

  const hasOrphans = orphanedDiagrams.length > 0 || orphanedPdsa.length > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold">Connected Canvas</h2>
        <p className="text-sm text-muted-foreground mt-1">
          View campaign completeness, find orphaned items, and connect your QI work together.
        </p>
      </div>

      {/* Campaign grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-nmh-teal" />
            Campaigns
          </h3>
          <Link href="/admin/campaigns">
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New Campaign
            </Button>
          </Link>
        </div>

        {campaigns.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <p>No campaigns yet. Create one to get started.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        )}
      </div>

      {/* Orphaned entities */}
      {hasOrphans && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h3 className="text-lg font-semibold">Unlinked Items</h3>
            <Badge variant="outline" className="text-amber-600 border-amber-300">
              {orphanedDiagrams.length + orphanedPdsa.length} items
            </Badge>
          </div>

          {/* Orphaned diagrams */}
          {orphanedDiagrams.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <GitBranchPlus className="h-4 w-4" />
                Driver Diagrams not linked to any campaign
              </h4>
              <div className="space-y-2">
                {orphanedDiagrams.map((d) => (
                  <Card key={d.id} className="p-3 border-amber-200 bg-amber-50/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{d.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.nodeCount} nodes &middot; {d.pdsaCycleCount} PDSA cycles
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setLinkDiagramId(d.id);
                            setError(null);
                          }}
                        >
                          <Link2 className="h-3 w-3 mr-1" />
                          Link to Campaign
                        </Button>
                        <Link href={`/admin/driver-diagrams/${d.id}`}>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Orphaned PDSA cycles */}
          {orphanedPdsa.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <RefreshCcw className="h-4 w-4" />
                PDSA Cycles not linked to any diagram
              </h4>
              <div className="space-y-2">
                {orphanedPdsa.map((p) => (
                  <Card key={p.id} className="p-3 border-amber-200 bg-amber-50/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{p.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Cycle #{p.cycleNumber} &middot; {p.status}
                        </p>
                      </div>
                      <Link href="/admin/pdsa-cycles">
                        <Button variant="outline" size="sm">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Edit in PDSA Admin
                        </Button>
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Link diagram to campaign dialog */}
      <Dialog
        open={linkDiagramId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setLinkDiagramId(null);
            setError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Diagram to Campaign</DialogTitle>
          </DialogHeader>
          {error && (
            <Card className="border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </Card>
          )}
          <form
            action={(formData) => {
              startTransition(async () => {
                const campaignId = formData.get("campaignId") as string;
                if (!campaignId || campaignId === "__none__" || !linkDiagramId) {
                  setLinkDiagramId(null);
                  return;
                }
                const result = await assignDiagramToCampaign(linkDiagramId, campaignId);
                if (result.success) {
                  setLinkDiagramId(null);
                } else {
                  setError(result.error ?? "Failed to link diagram.");
                }
              });
            }}
          >
            <div className="space-y-4">
              <div>
                <Label htmlFor="fc-link-campaign">Campaign</Label>
                <Select name="campaignId" defaultValue="__none__">
                  <SelectTrigger id="fc-link-campaign">
                    <SelectValue placeholder="Select a campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Cancel</SelectItem>
                    {campaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLinkDiagramId(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Linking..." : "Link"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campaign card with completeness
// ---------------------------------------------------------------------------

function CampaignCard({ campaign }: { campaign: CampaignSummary }) {
  const statusLabel = CAMPAIGN_STATUS_LABELS[campaign.status] ?? campaign.status;
  const statusColor = CAMPAIGN_STATUS_COLORS[campaign.status] ?? "#6b7280";

  const checks = [
    { label: "Aim / Goals", ok: campaign.completenessChecks.hasAim },
    { label: "Measures", ok: campaign.completenessChecks.hasMeasures },
    { label: "Driver Diagram", ok: campaign.completenessChecks.hasDiagram },
    { label: "PDSA Cycle(s)", ok: campaign.completenessChecks.hasPdsa },
    { label: "Action Items", ok: campaign.completenessChecks.hasActions },
  ];

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base">{campaign.name}</CardTitle>
          <Badge
            variant="outline"
            style={{ borderColor: statusColor, color: statusColor }}
            className="text-xs shrink-0"
          >
            {statusLabel}
          </Badge>
        </div>
        {campaign.ownerName && (
          <p className="text-xs text-muted-foreground">{campaign.ownerName}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Completeness</span>
            <span className="text-xs font-medium">{campaign.completeness}%</span>
          </div>
          <Progress value={campaign.completeness} className="h-2" />
        </div>

        {/* Checklist */}
        <div className="space-y-1">
          {checks.map((check) => (
            <div key={check.label} className="flex items-center gap-2 text-xs">
              {check.ok ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-muted-foreground/40" />
              )}
              <span className={check.ok ? "text-foreground" : "text-muted-foreground"}>
                {check.label}
              </span>
            </div>
          ))}
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t">
          <span>{campaign.diagramCount} diagrams</span>
          <span>{campaign.pdsaCycleCount} cycles</span>
          <span>{campaign.actionItemCount} actions</span>
        </div>

        {/* Link */}
        <Link href={`/admin/campaigns/${campaign.id}`}>
          <Button variant="outline" size="sm" className="w-full mt-1">
            <ExternalLink className="h-3 w-3 mr-1" />
            Open Campaign
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
