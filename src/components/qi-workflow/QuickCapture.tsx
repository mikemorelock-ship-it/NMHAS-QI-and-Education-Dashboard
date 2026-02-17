"use client";

import { useState, useTransition } from "react";
import { Target, GitBranchPlus, RefreshCcw, CheckCircle2, Link2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { createCampaign, assignDiagramToCampaign } from "@/actions/campaigns";
import { createDriverDiagram } from "@/actions/driver-diagrams";
import { createPdsaCycle } from "@/actions/pdsa-cycles";
import type {
  CampaignSummary,
  DiagramSummary,
  UserOption,
  MetricOption,
  ChangeIdeaOption,
} from "@/app/(admin)/admin/qi-workflow/page";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CreateType = "campaign" | "diagram" | "pdsa" | null;
type PostAction = "connect" | null;

interface QuickCaptureProps {
  campaigns: CampaignSummary[];
  diagrams: DiagramSummary[];
  users: UserOption[];
  metrics: MetricOption[];
  changeIdeas: ChangeIdeaOption[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuickCapture({
  campaigns,
  diagrams,
  users,
  metrics,
  changeIdeas,
}: QuickCaptureProps) {
  const [creating, setCreating] = useState<CreateType>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Post-creation connection state
  const [postAction, setPostAction] = useState<PostAction>(null);
  const [createdEntityId, setCreatedEntityId] = useState<string | null>(null);
  const [createdEntityType, setCreatedEntityType] = useState<CreateType>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const resetAll = () => {
    setCreating(null);
    setError(null);
    setPostAction(null);
    setCreatedEntityId(null);
    setCreatedEntityType(null);
  };

  // After a successful creation, show the option to connect
  const handleSuccess = (type: CreateType) => {
    setCreating(null);
    setCreatedEntityType(type);
    // For diagram and pdsa, offer to connect
    if (type === "diagram" || type === "pdsa") {
      setPostAction("connect");
    } else {
      setSuccessMessage(`Campaign created successfully!`);
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  const cards = [
    {
      id: "campaign" as const,
      icon: Target,
      title: "New Campaign",
      description: "Create a new QI campaign to organize improvement work.",
      color: "text-nmh-teal",
      bgColor: "bg-nmh-teal/10",
    },
    {
      id: "diagram" as const,
      icon: GitBranchPlus,
      title: "New Driver Diagram",
      description: "Create a driver diagram to map your improvement theory.",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      id: "pdsa" as const,
      icon: RefreshCcw,
      title: "New PDSA Cycle",
      description: "Start a PDSA cycle to test a change idea.",
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Quick Capture</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Create standalone items quickly. You can optionally connect them to existing campaigns or diagrams afterward.
        </p>
      </div>

      {successMessage && (
        <Card className="border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            <p className="text-sm font-medium">{successMessage}</p>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((c) => (
          <Card
            key={c.id}
            className="cursor-pointer hover:shadow-md transition-all"
            onClick={() => {
              setError(null);
              setCreating(c.id);
            }}
          >
            <CardHeader className="pb-2">
              <div className={`p-2.5 rounded-lg ${c.bgColor} w-fit`}>
                <c.icon className={`h-6 w-6 ${c.color}`} />
              </div>
              <CardTitle className="text-base mt-3">{c.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{c.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* --- Create Campaign Dialog --- */}
      <Dialog open={creating === "campaign"} onOpenChange={(open) => !open && resetAll()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Campaign</DialogTitle>
          </DialogHeader>
          {error && (
            <Card className="border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </Card>
          )}
          <form
            action={(formData) => {
              startTransition(async () => {
                const result = await createCampaign(formData);
                if (result.success) {
                  handleSuccess("campaign");
                } else {
                  setError(result.error ?? "Failed to create campaign.");
                }
              });
            }}
          >
            <div className="space-y-4">
              <div>
                <Label htmlFor="qc-campaign-name">Campaign Name *</Label>
                <Input id="qc-campaign-name" name="name" required maxLength={150} />
              </div>
              <div>
                <Label htmlFor="qc-campaign-goals">Aim / Goals</Label>
                <Textarea id="qc-campaign-goals" name="goals" maxLength={2000} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="qc-campaign-owner">Owner</Label>
                  <Select name="ownerId" defaultValue="__none__">
                    <SelectTrigger id="qc-campaign-owner">
                      <SelectValue placeholder="Select owner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Unassigned</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.firstName} {u.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="qc-campaign-status">Status</Label>
                  <Select name="status" defaultValue="planning">
                    <SelectTrigger id="qc-campaign-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planning">Planning</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <input type="hidden" name="sortOrder" value="0" />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={resetAll}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Creating..." : "Create Campaign"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* --- Create Diagram Dialog --- */}
      <Dialog open={creating === "diagram"} onOpenChange={(open) => !open && resetAll()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Driver Diagram</DialogTitle>
          </DialogHeader>
          {error && (
            <Card className="border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </Card>
          )}
          <form
            action={(formData) => {
              startTransition(async () => {
                const result = await createDriverDiagram(formData);
                if (result.success) {
                  handleSuccess("diagram");
                } else {
                  setError(result.error ?? "Failed to create diagram.");
                }
              });
            }}
          >
            <div className="space-y-4">
              <div>
                <Label htmlFor="qc-diagram-name">Diagram Name *</Label>
                <Input id="qc-diagram-name" name="name" required maxLength={150} />
              </div>
              <div>
                <Label htmlFor="qc-diagram-desc">Description</Label>
                <Textarea id="qc-diagram-desc" name="description" maxLength={500} rows={2} />
              </div>
              <div>
                <Label htmlFor="qc-diagram-metric">Linked Metric</Label>
                <Select name="metricDefinitionId" defaultValue="__none__">
                  <SelectTrigger id="qc-diagram-metric">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {metrics.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}{m.departmentName ? ` (${m.departmentName})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <input type="hidden" name="status" value="draft" />
              <input type="hidden" name="sortOrder" value="0" />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={resetAll}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Creating..." : "Create Diagram"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* --- Create PDSA Dialog --- */}
      <Dialog open={creating === "pdsa"} onOpenChange={(open) => !open && resetAll()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New PDSA Cycle</DialogTitle>
          </DialogHeader>
          {error && (
            <Card className="border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </Card>
          )}
          <form
            action={(formData) => {
              startTransition(async () => {
                const result = await createPdsaCycle(formData);
                if (result.success) {
                  handleSuccess("pdsa");
                } else {
                  setError(result.error ?? "Failed to create PDSA cycle.");
                }
              });
            }}
          >
            <div className="space-y-4">
              <div>
                <Label htmlFor="qc-pdsa-title">Cycle Title *</Label>
                <Input id="qc-pdsa-title" name="title" required maxLength={200} />
              </div>
              <div>
                <Label htmlFor="qc-pdsa-plan">Plan Description</Label>
                <Textarea id="qc-pdsa-plan" name="planDescription" maxLength={2000} rows={3} />
              </div>
              <div>
                <Label htmlFor="qc-pdsa-prediction">Prediction</Label>
                <Textarea id="qc-pdsa-prediction" name="planPrediction" maxLength={2000} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="qc-pdsa-diagram">Link to Diagram</Label>
                  <Select name="driverDiagramId" defaultValue="__none__">
                    <SelectTrigger id="qc-pdsa-diagram">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {diagrams.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="qc-pdsa-start">Plan Start Date</Label>
                  <Input
                    id="qc-pdsa-start"
                    name="planStartDate"
                    type="date"
                  />
                </div>
              </div>
              <input type="hidden" name="status" value="planning" />
              <input type="hidden" name="cycleNumber" value="1" />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={resetAll}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Creating..." : "Create PDSA Cycle"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* --- Post-Creation Connect Dialog --- */}
      <Dialog open={postAction === "connect"} onOpenChange={(open) => !open && resetAll()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-nmh-teal" />
              {createdEntityType === "diagram"
                ? "Link Diagram to a Campaign?"
                : "Link PDSA Cycle to a Diagram?"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {createdEntityType === "diagram"
              ? "Optionally connect this new diagram to an existing campaign."
              : "Optionally connect this new PDSA cycle to an existing diagram."}
          </p>
          <form
            action={(formData) => {
              startTransition(async () => {
                const targetId = formData.get("targetId") as string;
                if (!targetId || targetId === "__none__") {
                  // Skip — user chose not to connect
                  setSuccessMessage(
                    `${createdEntityType === "diagram" ? "Diagram" : "PDSA Cycle"} created!`
                  );
                  setTimeout(() => setSuccessMessage(null), 4000);
                  resetAll();
                  return;
                }

                if (createdEntityType === "diagram" && createdEntityId) {
                  const result = await assignDiagramToCampaign(createdEntityId, targetId);
                  if (result.success) {
                    setSuccessMessage("Diagram created and linked to campaign!");
                  } else {
                    setSuccessMessage("Diagram created, but linking failed.");
                  }
                } else {
                  // For PDSA — we'd need an updatePdsaCycle call, but the form-based
                  // server action requires FormData. For simplicity, show success and
                  // let user link from the existing admin page.
                  setSuccessMessage("PDSA Cycle created! Link it from the PDSA Cycles page.");
                }
                setTimeout(() => setSuccessMessage(null), 4000);
                resetAll();
              });
            }}
          >
            <div className="space-y-4">
              <div>
                <Label htmlFor="qc-connect-target">
                  {createdEntityType === "diagram" ? "Campaign" : "Diagram"}
                </Label>
                <Select name="targetId" defaultValue="__none__">
                  <SelectTrigger id="qc-connect-target">
                    <SelectValue placeholder="Skip — don't connect" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Skip — don&apos;t connect</SelectItem>
                    {createdEntityType === "diagram"
                      ? campaigns.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))
                      : diagrams.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSuccessMessage(
                      `${createdEntityType === "diagram" ? "Diagram" : "PDSA Cycle"} created!`
                    );
                    setTimeout(() => setSuccessMessage(null), 4000);
                    resetAll();
                  }}
                >
                  Skip
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Linking..." : "Connect"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
