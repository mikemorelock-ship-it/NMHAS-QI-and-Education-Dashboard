"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  createDriverDiagram,
  updateDriverDiagram,
  deleteDriverDiagram,
  toggleDriverDiagramActive,
} from "@/actions/driver-diagrams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Eye, EyeOff, ArrowRight, GitBranchPlus } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DiagramRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: "draft" | "active" | "archived";
  isActive: boolean;
  sortOrder: number;
  metricName: string | null;
  metricDefinitionId: string | null;
  campaignId: string | null;
  campaignName: string | null;
  nodeCount: number;
  pdsaCycleCount: number;
}

interface MetricOption {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DriverDiagramsClient({
  diagrams,
  metrics,
}: {
  diagrams: DiagramRow[];
  metrics: MetricOption[];
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DiagramRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DiagramRow | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openAdd() {
    setFormError(null);
    setAddOpen(true);
  }

  function openEdit(diagram: DiagramRow) {
    setFormError(null);
    setEditTarget(diagram);
  }

  function handleToggleActive(diagram: DiagramRow) {
    startTransition(async () => {
      await toggleDriverDiagramActive(diagram.id, !diagram.isActive);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-nmh-gray">Driver Diagrams</h1>
          <p className="text-muted-foreground mt-1">
            Manage driver diagrams for quality improvement initiatives.
          </p>
        </div>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button
              className="bg-nmh-teal hover:bg-nmh-teal/90 shrink-0 self-start sm:self-auto"
              onClick={openAdd}
            >
              <Plus className="h-4 w-4" />
              Add Diagram
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Driver Diagram</DialogTitle>
              <DialogDescription>
                Create a new driver diagram for quality improvement.
              </DialogDescription>
            </DialogHeader>
            <form
              action={async (formData) => {
                setFormError(null);
                const result = await createDriverDiagram(formData);
                if (result.success) {
                  setAddOpen(false);
                } else {
                  setFormError(result.error || "Failed to create diagram.");
                }
              }}
            >
              {formError && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 mb-3">
                  <p className="text-sm text-destructive">{formError}</p>
                </div>
              )}
              <DiagramFormFields metrics={metrics} />
              <DialogFooter className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setAddOpen(false);
                    setFormError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-nmh-teal hover:bg-nmh-teal/90">
                  Create Diagram
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border">
        {diagrams.length === 0 ? (
          <div className="text-center py-12">
            <GitBranchPlus className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              No driver diagrams yet. Create one to get started.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Linked Metric</TableHead>
                <TableHead className="text-center">Nodes</TableHead>
                <TableHead className="text-center">PDSA Cycles</TableHead>
                <TableHead className="text-center">Sort Order</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {diagrams.map((diagram) => (
                <TableRow key={diagram.id} className={!diagram.isActive ? "opacity-60" : undefined}>
                  <TableCell>
                    <div>
                      <span className="font-medium">{diagram.name}</span>
                      {diagram.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {diagram.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {diagram.campaignName ? (
                      <Link
                        href={`/admin/campaigns/${diagram.campaignId}`}
                        className="text-sm hover:text-nmh-teal"
                      >
                        {diagram.campaignName}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground text-sm">--</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={diagram.status === "draft" ? "outline" : "default"}
                      className={
                        diagram.status === "active"
                          ? "bg-green-100 text-green-700 hover:bg-green-100"
                          : diagram.status === "archived"
                            ? "bg-gray-100 text-gray-500 hover:bg-gray-100"
                            : ""
                      }
                    >
                      {diagram.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {diagram.metricName ?? <span className="text-muted-foreground">--</span>}
                  </TableCell>
                  <TableCell className="text-center">{diagram.nodeCount}</TableCell>
                  <TableCell className="text-center">{diagram.pdsaCycleCount}</TableCell>
                  <TableCell className="text-center">{diagram.sortOrder}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        title={diagram.isActive ? "Deactivate" : "Activate"}
                        onClick={() => handleToggleActive(diagram)}
                        disabled={isPending}
                      >
                        {diagram.isActive ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEdit(diagram)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/driver-diagrams/${diagram.id}`}>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(diagram)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditTarget(null);
            setFormError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Driver Diagram</DialogTitle>
            <DialogDescription>Update the diagram details.</DialogDescription>
          </DialogHeader>
          {editTarget && (
            <form
              key={editTarget.id}
              action={async (formData) => {
                setFormError(null);
                const result = await updateDriverDiagram(editTarget.id, formData);
                if (result.success) {
                  setEditTarget(null);
                } else {
                  setFormError(result.error || "Failed to update diagram.");
                }
              }}
            >
              {formError && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 mb-3">
                  <p className="text-sm text-destructive">{formError}</p>
                </div>
              )}
              <DiagramFormFields metrics={metrics} defaultValues={editTarget} />
              <DialogFooter className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditTarget(null);
                    setFormError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-nmh-teal hover:bg-nmh-teal/90">
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Driver Diagram</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This will remove the
              diagram, its {deleteTarget?.nodeCount ?? 0} nodes, and{" "}
              {deleteTarget?.pdsaCycleCount ?? 0} PDSA cycles. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <form
              action={async () => {
                if (deleteTarget) {
                  await deleteDriverDiagram(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
            >
              <Button type="submit" variant="destructive">
                Delete Diagram
              </Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form Fields
// ---------------------------------------------------------------------------

function DiagramFormFields({
  metrics,
  defaultValues,
}: {
  metrics: MetricOption[];
  defaultValues?: DiagramRow;
}) {
  return (
    <div className="space-y-4 py-2">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={defaultValues?.name ?? ""}
          placeholder="e.g., Response Time Improvement"
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={defaultValues?.description ?? ""}
          placeholder="Optional description"
          rows={2}
        />
      </div>

      {/* Status */}
      <div className="space-y-2">
        <Label>Status</Label>
        <Select name="status" defaultValue={defaultValues?.status ?? "draft"}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Linked Metric */}
      <div className="space-y-2">
        <Label>
          Linked Metric <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Select
          name="metricDefinitionId"
          defaultValue={defaultValues?.metricDefinitionId ?? "__none__"}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            {metrics.map((metric) => (
              <SelectItem key={metric.id} value={metric.id}>
                {metric.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Sort Order */}
      <div className="space-y-2">
        <Label htmlFor="sortOrder">Sort Order</Label>
        <Input
          id="sortOrder"
          name="sortOrder"
          type="number"
          min={0}
          defaultValue={defaultValues?.sortOrder ?? 0}
        />
      </div>
    </div>
  );
}
