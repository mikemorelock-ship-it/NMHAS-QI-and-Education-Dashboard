"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { createDriverNode, updateDriverNode, deleteDriverNode } from "@/actions/driver-diagrams";
import { DRIVER_NODE_TYPE_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ArrowLeft, RefreshCcw } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NodeRow {
  id: string;
  parentId: string | null;
  type: "aim" | "primary" | "secondary" | "changeIdea";
  text: string;
  description: string | null;
  sortOrder: number;
  pdsaCycleCount: number;
}

interface DiagramInfo {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  metricName: string | null;
}

interface DriverDiagramDetailClientProps {
  diagram: DiagramInfo;
  nodes: NodeRow[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BORDER_CLASSES: Record<string, string> = {
  aim: "border-l-4 border-l-[#00b0ad]",
  primary: "border-l-4 border-l-[#e04726]",
  secondary: "border-l-4 border-l-[#fcb526]",
  changeIdea: "border-l-4 border-l-[#4b4f54]",
};

const INDENT_CLASSES: Record<string, string> = {
  aim: "pl-2",
  primary: "pl-10",
  secondary: "pl-18",
  changeIdea: "pl-26",
};

const BADGE_CLASSES: Record<string, string> = {
  aim: "bg-[#00b0ad]/10 text-[#00b0ad] border-[#00b0ad]/20",
  primary: "bg-[#e04726]/10 text-[#e04726] border-[#e04726]/20",
  secondary: "bg-[#fcb526]/10 text-[#fcb526] border-[#fcb526]/20",
  changeIdea: "bg-[#4b4f54]/10 text-[#4b4f54] border-[#4b4f54]/20",
};

const CHILD_TYPE: Record<string, "primary" | "secondary" | "changeIdea" | null> = {
  aim: "primary",
  primary: "secondary",
  secondary: "changeIdea",
  changeIdea: null,
};

// ---------------------------------------------------------------------------
// Tree helpers
// ---------------------------------------------------------------------------

/** Flatten tree into display order (depth-first) using parent references */
function buildDisplayOrder(nodes: NodeRow[]): NodeRow[] {
  const childrenMap = new Map<string | null, NodeRow[]>();
  for (const n of nodes) {
    const key = n.parentId ?? "__root__";
    if (!childrenMap.has(key)) childrenMap.set(key, []);
    childrenMap.get(key)!.push(n);
  }

  const result: NodeRow[] = [];
  function walk(parentId: string | null) {
    const key = parentId ?? "__root__";
    const children = childrenMap.get(key) ?? [];
    for (const child of children) {
      result.push(child);
      walk(child.id);
    }
  }
  walk(null);
  return result;
}

/** Count all descendants of a node (for delete warning) */
function countDescendants(nodeId: string, nodes: NodeRow[]): number {
  const childrenMap = new Map<string, NodeRow[]>();
  for (const n of nodes) {
    if (n.parentId) {
      if (!childrenMap.has(n.parentId)) childrenMap.set(n.parentId, []);
      childrenMap.get(n.parentId)!.push(n);
    }
  }

  let count = 0;
  function walk(id: string) {
    const children = childrenMap.get(id) ?? [];
    count += children.length;
    for (const c of children) walk(c.id);
  }
  walk(nodeId);
  return count;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DriverDiagramDetailClient({ diagram, nodes }: DriverDiagramDetailClientProps) {
  const [isPending, startTransition] = useTransition();

  // Dialog state
  const [addNodeOpen, setAddNodeOpen] = useState(false);
  const [addNodeType, setAddNodeType] = useState<"aim" | "primary" | "secondary" | "changeIdea">(
    "aim"
  );
  const [addNodeParentId, setAddNodeParentId] = useState<string | null>(null);

  const [editNode, setEditNode] = useState<NodeRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NodeRow | null>(null);

  // Error state
  const [error, setError] = useState<string | null>(null);

  const displayNodes = buildDisplayOrder(nodes);
  const hasAim = nodes.some((n) => n.type === "aim");

  // Handlers
  function handleAddChild(parentNode: NodeRow) {
    const childType = CHILD_TYPE[parentNode.type];
    if (!childType) return;
    setAddNodeType(childType);
    setAddNodeParentId(parentNode.id);
    setError(null);
    setAddNodeOpen(true);
  }

  function handleAddAim() {
    setAddNodeType("aim");
    setAddNodeParentId(null);
    setError(null);
    setAddNodeOpen(true);
  }

  function handleEdit(node: NodeRow) {
    setError(null);
    setEditNode(node);
  }

  function handleDelete(node: NodeRow) {
    setError(null);
    setDeleteTarget(node);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/driver-diagrams">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-nmh-gray">{diagram.name}</h1>
            <Badge variant="outline" className="capitalize">
              {diagram.status}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Driver Diagrams &gt; {diagram.name}
            {diagram.metricName && (
              <span className="ml-2 text-xs text-muted-foreground">
                (Metric: {diagram.metricName})
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Tree Visualization */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold text-nmh-gray">Node Tree</h2>
          {!hasAim && (
            <Button size="sm" className="bg-nmh-teal hover:bg-nmh-teal/90" onClick={handleAddAim}>
              <Plus className="h-4 w-4" />
              Add Aim
            </Button>
          )}
        </div>

        {displayNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <p className="text-muted-foreground mb-4">
              No nodes yet. Start by adding an Aim statement for this driver diagram.
            </p>
            <Button size="lg" className="bg-nmh-teal hover:bg-nmh-teal/90" onClick={handleAddAim}>
              <Plus className="h-5 w-5" />
              Add Aim Statement
            </Button>
          </div>
        ) : (
          <div className="divide-y">
            {displayNodes.map((node) => (
              <div
                key={node.id}
                className={`flex items-center gap-3 py-3 pr-4 ${BORDER_CLASSES[node.type]} ${INDENT_CLASSES[node.type]}`}
              >
                {/* Node content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-xs shrink-0 ${BADGE_CLASSES[node.type]}`}
                    >
                      {DRIVER_NODE_TYPE_LABELS[node.type]}
                    </Badge>
                    <span className="font-medium text-sm truncate">{node.text}</span>
                    {node.type === "changeIdea" && node.pdsaCycleCount > 0 && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        <RefreshCcw className="h-3 w-3 mr-1" />
                        {node.pdsaCycleCount} PDSA
                      </Badge>
                    )}
                  </div>
                  {node.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-md">
                      {node.description}
                    </p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  {CHILD_TYPE[node.type] && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddChild(node)}
                      title={`Add ${DRIVER_NODE_TYPE_LABELS[CHILD_TYPE[node.type]!]}`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(node)}
                    title="Edit node"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(node)}
                    title="Delete node"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* Add Node Dialog                                                    */}
      {/* ================================================================= */}
      <Dialog open={addNodeOpen} onOpenChange={setAddNodeOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add {DRIVER_NODE_TYPE_LABELS[addNodeType]}</DialogTitle>
            <DialogDescription>
              Create a new {DRIVER_NODE_TYPE_LABELS[addNodeType].toLowerCase()} node in this driver
              diagram.
            </DialogDescription>
          </DialogHeader>
          <form
            action={async (formData) => {
              startTransition(async () => {
                const result = await createDriverNode(formData);
                if (result.success) {
                  setAddNodeOpen(false);
                  setError(null);
                } else {
                  setError(result.error ?? "Failed to create node.");
                }
              });
            }}
          >
            <input type="hidden" name="driverDiagramId" value={diagram.id} />
            <input type="hidden" name="parentId" value={addNodeParentId ?? ""} />
            <input type="hidden" name="type" value={addNodeType} />

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="add-type-display">Type</Label>
                <Input
                  id="add-type-display"
                  value={DRIVER_NODE_TYPE_LABELS[addNodeType]}
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-text">Text</Label>
                <Input
                  id="add-text"
                  name="text"
                  placeholder={`Enter ${DRIVER_NODE_TYPE_LABELS[addNodeType].toLowerCase()} text`}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-description">Description (optional)</Label>
                <Textarea
                  id="add-description"
                  name="description"
                  placeholder="Additional details about this node"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-sortOrder">Sort Order</Label>
                <Input id="add-sortOrder" name="sortOrder" type="number" defaultValue={0} min={0} />
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setAddNodeOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-nmh-teal hover:bg-nmh-teal/90"
                disabled={isPending}
              >
                {isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================================================================= */}
      {/* Edit Node Dialog                                                   */}
      {/* ================================================================= */}
      <Dialog open={editNode !== null} onOpenChange={(open) => !open && setEditNode(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Edit {editNode ? DRIVER_NODE_TYPE_LABELS[editNode.type] : "Node"}
            </DialogTitle>
            <DialogDescription>Update this node&apos;s text and details.</DialogDescription>
          </DialogHeader>
          {editNode && (
            <form
              action={async (formData) => {
                startTransition(async () => {
                  const result = await updateDriverNode(editNode.id, formData);
                  if (result.success) {
                    setEditNode(null);
                    setError(null);
                  } else {
                    setError(result.error ?? "Failed to update node.");
                  }
                });
              }}
            >
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-type-display">Type</Label>
                  <Input
                    id="edit-type-display"
                    value={DRIVER_NODE_TYPE_LABELS[editNode.type]}
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-text">Text</Label>
                  <Input
                    id="edit-text"
                    name="text"
                    defaultValue={editNode.text}
                    placeholder="Node text"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description (optional)</Label>
                  <Textarea
                    id="edit-description"
                    name="description"
                    defaultValue={editNode.description ?? ""}
                    placeholder="Additional details about this node"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-sortOrder">Sort Order</Label>
                  <Input
                    id="edit-sortOrder"
                    name="sortOrder"
                    type="number"
                    defaultValue={editNode.sortOrder}
                    min={0}
                  />
                </div>
              </div>

              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setEditNode(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-nmh-teal hover:bg-nmh-teal/90"
                  disabled={isPending}
                >
                  {isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ================================================================= */}
      {/* Delete Node Confirmation Dialog                                    */}
      {/* ================================================================= */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Node</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the{" "}
              {deleteTarget ? DRIVER_NODE_TYPE_LABELS[deleteTarget.type].toLowerCase() : "node"}{" "}
              &quot;{deleteTarget?.text}&quot;?
              {deleteTarget && countDescendants(deleteTarget.id, nodes) > 0 && (
                <>
                  {" "}
                  This will also delete{" "}
                  <strong>
                    {countDescendants(deleteTarget.id, nodes)} child node
                    {countDescendants(deleteTarget.id, nodes) === 1 ? "" : "s"}
                  </strong>{" "}
                  and any associated PDSA cycles. This cannot be undone.
                </>
              )}
              {deleteTarget && countDescendants(deleteTarget.id, nodes) === 0 && (
                <> This cannot be undone.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <form
              action={async () => {
                if (!deleteTarget) return;
                startTransition(async () => {
                  const result = await deleteDriverNode(deleteTarget.id);
                  if (result.success) {
                    setDeleteTarget(null);
                    setError(null);
                  } else {
                    setError(result.error ?? "Failed to delete node.");
                    setDeleteTarget(null);
                  }
                });
              }}
            >
              <Button type="submit" variant="destructive" disabled={isPending}>
                {isPending ? "Deleting..." : "Delete"}
              </Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
