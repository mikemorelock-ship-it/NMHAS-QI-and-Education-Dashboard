"use client";

import { useState } from "react";
import { X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { NODE_TYPES, type NodeType } from "./constants";

interface NodeData {
  id: string;
  label: string;
  description?: string;
  nodeType: NodeType;
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
}

interface NodePropertiesPanelProps {
  node: NodeData;
  onUpdate: (
    id: string,
    data: { label?: string; description?: string; nodeType?: NodeType }
  ) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

// Uses key={node.id} in parent to re-mount when selection changes
export function NodePropertiesPanel({
  node,
  onUpdate,
  onDelete,
  onClose,
}: NodePropertiesPanelProps) {
  const [label, setLabel] = useState(node.label);
  const [description, setDescription] = useState(node.description ?? "");
  const [nodeType, setNodeType] = useState<NodeType>(node.nodeType);

  const config = NODE_TYPES[nodeType];
  const isLinked = !!node.linkedEntityType;

  const handleSave = () => {
    const updates: { label?: string; description?: string; nodeType?: NodeType } = {};
    if (label !== node.label) updates.label = label;
    if (description !== (node.description ?? "")) updates.description = description || undefined;
    if (nodeType !== node.nodeType) updates.nodeType = nodeType;
    if (Object.keys(updates).length > 0) {
      onUpdate(node.id, updates);
    }
  };

  return (
    <div className="absolute top-0 right-0 z-20 h-full w-72 border-l bg-white shadow-lg overflow-y-auto">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="text-sm font-semibold">Node Properties</h3>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: config.color }} />
          <Badge variant="outline" className="text-xs">
            {config.label}
          </Badge>
          {isLinked && (
            <Badge variant="secondary" className="text-xs">
              Linked
            </Badge>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="node-type">Type</Label>
          <Select value={nodeType} onValueChange={(v) => setNodeType(v as NodeType)}>
            <SelectTrigger id="node-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(NODE_TYPES) as NodeType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: NODE_TYPES[t].color }}
                    />
                    {NODE_TYPES[t].label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="node-label">Label</Label>
          <Input
            id="node-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleSave}
            placeholder="Node name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="node-desc">Description</Label>
          <Textarea
            id="node-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleSave}
            placeholder="Optional description"
            rows={3}
          />
        </div>

        <Button variant="outline" size="sm" className="w-full" onClick={handleSave}>
          Save Changes
        </Button>

        <div className="pt-4 border-t">
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => onDelete(node.id)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Node
          </Button>
        </div>
      </div>
    </div>
  );
}
