"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { assignDiagramToCampaign } from "@/actions/campaigns";
import {
  createActionItem,
  updateActionItem,
  deleteActionItem,
  toggleActionItemStatus,
} from "@/actions/action-items";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  X,
  GitBranchPlus,
  RefreshCcw,
  CheckCircle2,
  ListChecks,
} from "lucide-react";
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_COLORS,
  PDSA_STATUS_LABELS,
  PDSA_STATUS_COLORS,
  ACTION_ITEM_STATUS_LABELS,
  ACTION_ITEM_STATUS_COLORS,
  ACTION_ITEM_PRIORITY_LABELS,
  ACTION_ITEM_PRIORITY_COLORS,
  PDSA_OUTCOME_LABELS,
} from "@/lib/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CampaignInfo {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  goals: string | null;
  status: string;
  ownerName: string | null;
  startDate: string | null;
  endDate: string | null;
}

interface DiagramRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  isActive: boolean;
  metricName: string | null;
  nodeCount: number;
  pdsaCycleCount: number;
}

interface CycleRow {
  id: string;
  title: string;
  cycleNumber: number;
  status: string;
  outcome: string | null;
  diagramName: string | null;
  metricName: string | null;
  updatedAt: string;
}

interface ActionItemRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  completedAt: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  pdsaCycleId: string | null;
  pdsaCycleName: string | null;
  campaignId: string;
}

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface LookupItem {
  id: string;
  name?: string;
  title?: string;
}

interface Props {
  campaign: CampaignInfo;
  diagrams: DiagramRow[];
  unassignedDiagrams: { id: string; name: string }[];
  cycles: CycleRow[];
  actionItems: ActionItemRow[];
  users: UserOption[];
  campaigns: LookupItem[];
  campaignCycles: { id: string; title: string }[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CampaignDetailClient({
  campaign,
  diagrams,
  unassignedDiagrams,
  cycles,
  actionItems,
  users,
  campaignCycles,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showAddDiagram, setShowAddDiagram] = useState(false);
  const [selectedDiagramId, setSelectedDiagramId] = useState("");
  const [showCreateAction, setShowCreateAction] = useState(false);
  const [editAction, setEditAction] = useState<ActionItemRow | null>(null);
  const [deleteAction, setDeleteAction] = useState<ActionItemRow | null>(null);

  // --- Diagram management ---
  function handleAddDiagram() {
    if (!selectedDiagramId) return;
    startTransition(async () => {
      const res = await assignDiagramToCampaign(selectedDiagramId, campaign.id);
      if (!res.success) setError(res.error ?? "Failed");
      else {
        setShowAddDiagram(false);
        setSelectedDiagramId("");
      }
    });
  }

  function handleRemoveDiagram(diagramId: string) {
    startTransition(async () => {
      const res = await assignDiagramToCampaign(diagramId, null);
      if (!res.success) setError(res.error ?? "Failed");
    });
  }

  // --- Action item management ---
  function stripNone(fd: FormData) {
    for (const [key, val] of Array.from(fd.entries())) {
      if (val === "__none__") fd.set(key, "");
    }
  }

  function handleCreateAction(fd: FormData) {
    stripNone(fd);
    fd.set("campaignId", campaign.id);
    startTransition(async () => {
      const res = await createActionItem(fd);
      if (!res.success) setError(res.error ?? "Failed");
      else setShowCreateAction(false);
    });
  }

  function handleEditAction(fd: FormData) {
    if (!editAction) return;
    stripNone(fd);
    fd.set("campaignId", campaign.id);
    startTransition(async () => {
      const res = await updateActionItem(editAction.id, fd);
      if (!res.success) setError(res.error ?? "Failed");
      else setEditAction(null);
    });
  }

  function handleDeleteAction() {
    if (!deleteAction) return;
    startTransition(async () => {
      const res = await deleteActionItem(deleteAction.id);
      if (!res.success) setError(res.error ?? "Failed");
      else setDeleteAction(null);
    });
  }

  function handleToggleComplete(item: ActionItemRow) {
    const newStatus = item.status === "completed" ? "open" : "completed";
    startTransition(async () => {
      const res = await toggleActionItemStatus(item.id, newStatus);
      if (!res.success) setError(res.error ?? "Failed");
    });
  }

  const statusColor = CAMPAIGN_STATUS_COLORS[campaign.status] ?? "#4b4f54";

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Header */}
      <div>
        <Link
          href="/admin/campaigns"
          className="text-sm text-muted-foreground hover:text-nmh-teal flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Campaigns
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-nmh-gray">{campaign.name}</h1>
          <Badge
            variant="secondary"
            style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
          >
            {CAMPAIGN_STATUS_LABELS[campaign.status] ?? campaign.status}
          </Badge>
        </div>
        {campaign.description && (
          <p className="text-sm text-muted-foreground mt-1">{campaign.description}</p>
        )}
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* Campaign Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground mb-1">Owner</p>
            <p className="text-sm font-medium">{campaign.ownerName ?? "Unassigned"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground mb-1">Timeline</p>
            <p className="text-sm font-medium">
              {campaign.startDate ?? "—"} → {campaign.endDate ?? "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground mb-1">Goals</p>
            {campaign.goals ? (
              <div className="text-sm whitespace-pre-line">{campaign.goals}</div>
            ) : (
              <p className="text-sm text-muted-foreground">No goals set</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Driver Diagrams */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranchPlus className="h-4 w-4 text-nmh-teal" />
            Driver Diagrams ({diagrams.length})
          </CardTitle>
          {unassignedDiagrams.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setShowAddDiagram(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Diagram
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {diagrams.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No diagrams linked to this campaign yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-center">Nodes</TableHead>
                  <TableHead className="text-center">PDSA Cycles</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {diagrams.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <Link
                        href={`/admin/driver-diagrams/${d.id}`}
                        className="font-medium hover:text-nmh-teal"
                      >
                        {d.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {d.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {d.metricName ?? "—"}
                    </TableCell>
                    <TableCell className="text-center">{d.nodeCount}</TableCell>
                    <TableCell className="text-center">{d.pdsaCycleCount}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveDiagram(d.id)}
                        title="Remove from campaign"
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* PDSA Cycles (read-only) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCcw className="h-4 w-4 text-nmh-orange" />
            PDSA Cycles ({cycles.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cycles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No PDSA cycles in this campaign&apos;s diagrams yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Cycle #</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Diagram</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cycles.map((c) => {
                  const sColor = PDSA_STATUS_COLORS[c.status] ?? "#4b4f54";
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.title}</TableCell>
                      <TableCell>{c.cycleNumber}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          style={{ backgroundColor: `${sColor}20`, color: sColor }}
                        >
                          {PDSA_STATUS_LABELS[c.status] ?? c.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {c.outcome ? (
                          <Badge variant="outline" className="text-xs">
                            {PDSA_OUTCOME_LABELS[c.outcome] ?? c.outcome}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.diagramName ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.updatedAt}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Action Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-nmh-teal" />
            Action Items ({actionItems.length})
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setError(null);
              setShowCreateAction(true);
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Action Item
          </Button>
        </CardHeader>
        <CardContent>
          {actionItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No action items yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {actionItems.map((a) => {
                  const pColor = ACTION_ITEM_PRIORITY_COLORS[a.priority] ?? "#4b4f54";
                  const sColor = ACTION_ITEM_STATUS_COLORS[a.status] ?? "#4b4f54";
                  return (
                    <TableRow key={a.id} className={a.status === "completed" ? "opacity-60" : ""}>
                      <TableCell>
                        <button
                          onClick={() => handleToggleComplete(a)}
                          className="hover:scale-110 transition-transform"
                        >
                          <CheckCircle2
                            className={`h-5 w-5 ${a.status === "completed" ? "text-green-600" : "text-muted-foreground/30"}`}
                          />
                        </button>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`font-medium ${a.status === "completed" ? "line-through" : ""}`}
                        >
                          {a.title}
                        </span>
                        {a.pdsaCycleName && (
                          <span className="block text-xs text-muted-foreground">
                            → {a.pdsaCycleName}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          style={{ backgroundColor: `${pColor}20`, color: pColor }}
                          className="text-xs"
                        >
                          {ACTION_ITEM_PRIORITY_LABELS[a.priority] ?? a.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {a.assigneeName ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {a.dueDate ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          style={{ backgroundColor: `${sColor}20`, color: sColor }}
                          className="text-xs"
                        >
                          {ACTION_ITEM_STATUS_LABELS[a.status] ?? a.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setError(null);
                              setEditAction(a);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteAction(a)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Diagram Dialog */}
      <Dialog open={showAddDiagram} onOpenChange={setShowAddDiagram}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Diagram to Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Select a diagram</Label>
            <Select value={selectedDiagramId} onValueChange={setSelectedDiagramId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose diagram..." />
              </SelectTrigger>
              <SelectContent>
                {unassignedDiagrams.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDiagram(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddDiagram} disabled={!selectedDiagramId || isPending}>
              {isPending ? "Adding..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Action Item Dialog */}
      <Dialog open={showCreateAction} onOpenChange={setShowCreateAction}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Action Item</DialogTitle>
          </DialogHeader>
          <form action={handleCreateAction}>
            <ActionItemFormFields users={users} campaignCycles={campaignCycles} />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setShowCreateAction(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Action Item Dialog */}
      <Dialog
        open={!!editAction}
        onOpenChange={(open) => {
          if (!open) setEditAction(null);
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Action Item</DialogTitle>
          </DialogHeader>
          {editAction && (
            <form action={handleEditAction}>
              <ActionItemFormFields
                users={users}
                campaignCycles={campaignCycles}
                defaults={editAction}
              />
              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setEditAction(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Action Item Dialog */}
      <Dialog
        open={!!deleteAction}
        onOpenChange={(open) => {
          if (!open) setDeleteAction(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Action Item</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{deleteAction?.title}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAction(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAction} disabled={isPending}>
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action Item Form Fields
// ---------------------------------------------------------------------------

function ActionItemFormFields({
  users,
  campaignCycles,
  defaults,
}: {
  users: { id: string; firstName: string; lastName: string }[];
  campaignCycles: { id: string; title: string }[];
  defaults?: Partial<ActionItemRow>;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          name="title"
          defaultValue={defaults?.title ?? ""}
          required
          maxLength={200}
        />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={defaults?.description ?? ""}
          rows={3}
          maxLength={2000}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="status">Status</Label>
          <Select name="status" defaultValue={defaults?.status ?? "open"}>
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ACTION_ITEM_STATUS_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="priority">Priority</Label>
          <Select name="priority" defaultValue={defaults?.priority ?? "medium"}>
            <SelectTrigger id="priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ACTION_ITEM_PRIORITY_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="assigneeId">Assignee</Label>
          <Select name="assigneeId" defaultValue={defaults?.assigneeId ?? "__none__"}>
            <SelectTrigger id="assigneeId">
              <SelectValue placeholder="Unassigned" />
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
          <Label htmlFor="dueDate">Due Date</Label>
          <Input id="dueDate" name="dueDate" type="date" defaultValue={defaults?.dueDate ?? ""} />
        </div>
      </div>
      {campaignCycles.length > 0 && (
        <div>
          <Label htmlFor="pdsaCycleId">Linked PDSA Cycle</Label>
          <Select name="pdsaCycleId" defaultValue={defaults?.pdsaCycleId ?? "__none__"}>
            <SelectTrigger id="pdsaCycleId">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {campaignCycles.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
