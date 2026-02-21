"use client";

import { useState, useMemo, useTransition } from "react";
import {
  createActionItem,
  updateActionItem,
  deleteActionItem,
  toggleActionItemStatus,
} from "@/actions/action-items";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Plus, Pencil, Trash2, CheckCircle2 } from "lucide-react";
import {
  ACTION_ITEM_STATUS_LABELS,
  ACTION_ITEM_STATUS_COLORS,
  ACTION_ITEM_PRIORITY_LABELS,
  ACTION_ITEM_PRIORITY_COLORS,
} from "@/lib/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActionItemRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  completedAt: string | null;
  campaignId: string | null;
  campaignName: string | null;
  pdsaCycleId: string | null;
  pdsaCycleName: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
}

interface LookupItem {
  id: string;
  name?: string;
  title?: string;
}

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface Props {
  actionItems: ActionItemRow[];
  campaigns: LookupItem[];
  cycles: { id: string; title: string }[];
  users: UserOption[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActionItemsClient({ actionItems, campaigns, cycles, users }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<ActionItemRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ActionItemRow | null>(null);
  const [filterStatus, setFilterStatus] = useState("__all__");
  const [filterPriority, setFilterPriority] = useState("__all__");
  const [filterCampaign, setFilterCampaign] = useState("__all__");

  const filtered = useMemo(() => {
    return actionItems.filter((a) => {
      if (filterStatus !== "__all__" && a.status !== filterStatus) return false;
      if (filterPriority !== "__all__" && a.priority !== filterPriority) return false;
      if (filterCampaign !== "__all__") {
        if (filterCampaign === "__none__" && a.campaignId !== null) return false;
        if (filterCampaign !== "__none__" && a.campaignId !== filterCampaign) return false;
      }
      return true;
    });
  }, [actionItems, filterStatus, filterPriority, filterCampaign]);

  function stripNone(fd: FormData) {
    for (const [key, val] of Array.from(fd.entries())) {
      if (val === "__none__") fd.set(key, "");
    }
  }

  function handleCreate(fd: FormData) {
    stripNone(fd);
    startTransition(async () => {
      const res = await createActionItem(fd);
      if (!res.success) setError(res.error ?? "Failed");
      else setShowCreate(false);
    });
  }

  function handleEdit(fd: FormData) {
    if (!editTarget) return;
    stripNone(fd);
    startTransition(async () => {
      const res = await updateActionItem(editTarget.id, fd);
      if (!res.success) setError(res.error ?? "Failed");
      else setEditTarget(null);
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const res = await deleteActionItem(deleteTarget.id);
      if (!res.success) setError(res.error ?? "Failed");
      else setDeleteTarget(null);
    });
  }

  function handleToggle(item: ActionItemRow) {
    const newStatus = item.status === "completed" ? "open" : "completed";
    startTransition(async () => {
      const res = await toggleActionItemStatus(item.id, newStatus);
      if (!res.success) setError(res.error ?? "Failed");
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-nmh-gray">Action Items</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track corrective actions across campaigns and PDSA cycles
          </p>
        </div>
        <Button
          onClick={() => {
            setError(null);
            setShowCreate(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" aria-hidden="true" /> New Action Item
        </Button>
      </div>

      <div aria-live="polite">
        {error && (
          <Card className="border-destructive">
            <CardContent className="py-3 text-sm text-destructive" role="alert">
              {error}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Statuses</SelectItem>
            {Object.entries(ACTION_ITEM_STATUS_LABELS).map(([val, label]) => (
              <SelectItem key={val} value={val}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Priorities</SelectItem>
            {Object.entries(ACTION_ITEM_PRIORITY_LABELS).map(([val, label]) => (
              <SelectItem key={val} value={val}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCampaign} onValueChange={setFilterCampaign}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Campaigns" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Campaigns</SelectItem>
            <SelectItem value="__none__">No Campaign</SelectItem>
            {campaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No action items found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((a) => {
                  const pColor = ACTION_ITEM_PRIORITY_COLORS[a.priority] ?? "#4b4f54";
                  const sColor = ACTION_ITEM_STATUS_COLORS[a.status] ?? "#4b4f54";
                  return (
                    <TableRow key={a.id} className={a.status === "completed" ? "opacity-60" : ""}>
                      <TableCell>
                        <button
                          onClick={() => handleToggle(a)}
                          className="hover:scale-110 transition-transform"
                          aria-label={
                            a.status === "completed"
                              ? `Mark "${a.title}" as open`
                              : `Mark "${a.title}" as completed`
                          }
                        >
                          <CheckCircle2
                            className={`h-5 w-5 ${a.status === "completed" ? "text-green-600" : "text-muted-foreground/30"}`}
                            aria-hidden="true"
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
                      <TableCell className="text-sm text-muted-foreground">
                        {a.campaignName ?? "—"}
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
                              setEditTarget(a);
                            }}
                            aria-label={`Edit "${a.title}"`}
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(a)}
                            aria-label={`Delete "${a.title}"`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Action Item</DialogTitle>
          </DialogHeader>
          <form action={handleCreate}>
            <ActionItemFormFields users={users} campaigns={campaigns} cycles={cycles} />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Action Item</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <form action={handleEdit}>
              <ActionItemFormFields
                users={users}
                campaigns={campaigns}
                cycles={cycles}
                defaults={editTarget}
              />
              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
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

      {/* Delete Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Action Item</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{deleteTarget?.title}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form Fields
// ---------------------------------------------------------------------------

function ActionItemFormFields({
  users,
  campaigns,
  cycles,
  defaults,
}: {
  users: UserOption[];
  campaigns: LookupItem[];
  cycles: { id: string; title: string }[];
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
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="campaignId">Campaign</Label>
          <Select name="campaignId" defaultValue={defaults?.campaignId ?? "__none__"}>
            <SelectTrigger id="campaignId">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="pdsaCycleId">PDSA Cycle</Label>
          <Select name="pdsaCycleId" defaultValue={defaults?.pdsaCycleId ?? "__none__"}>
            <SelectTrigger id="pdsaCycleId">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {cycles.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
