"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export interface MapSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  _count: { nodes: number; edges: number };
}

interface MapSelectorBarProps {
  maps: MapSummary[];
  selectedMapId: string | null;
  onSelectMap: (id: string) => void;
  onCreateMap: (name: string, description: string) => Promise<void>;
  onUpdateMap: (id: string, name: string, description: string) => Promise<void>;
  onDeleteMap: (id: string) => Promise<void>;
}

export function MapSelectorBar({
  maps,
  selectedMapId,
  onSelectMap,
  onCreateMap,
  onUpdateMap,
  onDeleteMap,
}: MapSelectorBarProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedMap = maps.find((m) => m.id === selectedMapId);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    await onCreateMap(name.trim(), description.trim());
    setName("");
    setDescription("");
    setShowCreate(false);
    setLoading(false);
  };

  const handleEdit = async () => {
    if (!selectedMapId || !name.trim()) return;
    setLoading(true);
    await onUpdateMap(selectedMapId, name.trim(), description.trim());
    setShowEdit(false);
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!selectedMapId) return;
    setLoading(true);
    await onDeleteMap(selectedMapId);
    setShowDelete(false);
    setLoading(false);
  };

  const openEdit = () => {
    if (selectedMap) {
      setName(selectedMap.name);
      setDescription(selectedMap.description ?? "");
      setShowEdit(true);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Map className="h-4 w-4" />
          Map:
        </div>
        <Select
          value={selectedMapId ?? ""}
          onValueChange={onSelectMap}
        >
          <SelectTrigger className="w-[260px]">
            <SelectValue placeholder="Select a map..." />
          </SelectTrigger>
          <SelectContent>
            {maps.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
                <span className="ml-2 text-xs text-muted-foreground">
                  ({m._count.nodes} nodes)
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setName("");
            setDescription("");
            setShowCreate(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" />
          New Map
        </Button>

        {selectedMapId && (
          <>
            <Button variant="ghost" size="sm" onClick={openEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setShowDelete(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}

        {selectedMap && (
          <span className="ml-auto text-xs text-muted-foreground">
            {selectedMap._count.nodes} nodes, {selectedMap._count.edges}{" "}
            connections
          </span>
        )}
      </div>

      {/* Create Map Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Map</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="map-name">Name</Label>
              <Input
                id="map-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., QI Ecosystem Overview"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="map-desc">Description (optional)</Label>
              <Textarea
                id="map-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this map represent?"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreate(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || loading}
            >
              {loading ? "Creating..." : "Create Map"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Map Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Map</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea
                id="edit-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEdit(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={!name.trim() || loading}
            >
              {loading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Map</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete &quot;{selectedMap?.name}&quot;?
            This will permanently remove all nodes and connections. This action
            cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDelete(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
