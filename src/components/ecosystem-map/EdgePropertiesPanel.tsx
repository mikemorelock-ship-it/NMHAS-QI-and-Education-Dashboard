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
import { RELATIONSHIP_TYPES, type RelationshipType } from "./constants";

interface EdgeData {
  id: string;
  relationshipType: RelationshipType;
  label?: string;
  description?: string;
  sourceName?: string;
  targetName?: string;
}

interface EdgePropertiesPanelProps {
  edge: EdgeData;
  onUpdate: (
    id: string,
    data: {
      relationshipType?: RelationshipType;
      label?: string;
      description?: string;
    },
  ) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

// Uses key={edge.id} in parent to re-mount when selection changes
export function EdgePropertiesPanel({
  edge,
  onUpdate,
  onDelete,
  onClose,
}: EdgePropertiesPanelProps) {
  const [relType, setRelType] = useState<RelationshipType>(
    edge.relationshipType,
  );
  const [label, setLabel] = useState(edge.label ?? "");
  const [description, setDescription] = useState(edge.description ?? "");

  const config = RELATIONSHIP_TYPES[relType];

  const handleSave = () => {
    const updates: {
      relationshipType?: RelationshipType;
      label?: string;
      description?: string;
    } = {};
    if (relType !== edge.relationshipType) updates.relationshipType = relType;
    if (label !== (edge.label ?? "")) updates.label = label || undefined;
    if (description !== (edge.description ?? ""))
      updates.description = description || undefined;
    if (Object.keys(updates).length > 0) {
      onUpdate(edge.id, updates);
    }
  };

  return (
    <div className="absolute top-0 right-0 z-20 h-full w-72 border-l bg-white shadow-lg overflow-y-auto">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="text-sm font-semibold">Connection Properties</h3>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 space-y-4">
        {edge.sourceName && edge.targetName && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {edge.sourceName}
            </span>
            {" \u2192 "}
            <span className="font-medium text-foreground">
              {edge.targetName}
            </span>
          </p>
        )}

        <div className="flex items-center gap-2">
          <div
            className="h-3 w-6 rounded-sm"
            style={{
              backgroundColor: config.color,
            }}
          />
          <Badge variant="outline" className="text-xs">
            {config.label}
          </Badge>
        </div>

        <div className="space-y-2">
          <Label htmlFor="edge-type">Relationship Type</Label>
          <Select
            value={relType}
            onValueChange={(v) => {
              setRelType(v as RelationshipType);
            }}
          >
            <SelectTrigger id="edge-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(RELATIONSHIP_TYPES) as RelationshipType[]).map(
                (t) => (
                  <SelectItem key={t} value={t}>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-6 rounded-sm"
                        style={{
                          backgroundColor: RELATIONSHIP_TYPES[t].color,
                        }}
                      />
                      {RELATIONSHIP_TYPES[t].label}
                    </div>
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="edge-label">Label (optional)</Label>
          <Input
            id="edge-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleSave}
            placeholder="e.g., Data sharing"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="edge-desc">Description</Label>
          <Textarea
            id="edge-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleSave}
            placeholder="Describe this relationship"
            rows={3}
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleSave}
        >
          Save Changes
        </Button>

        <div className="pt-4 border-t">
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => onDelete(edge.id)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Connection
          </Button>
        </div>
      </div>
    </div>
  );
}
