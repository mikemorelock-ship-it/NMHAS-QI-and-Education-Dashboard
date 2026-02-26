"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RELATIONSHIP_TYPES, type RelationshipType } from "./constants";

interface ConnectionTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (type: RelationshipType) => void;
  sourceName?: string;
  targetName?: string;
}

export function ConnectionTypeDialog({
  open,
  onOpenChange,
  onSelect,
  sourceName,
  targetName,
}: ConnectionTypeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose Relationship Type</DialogTitle>
          {sourceName && targetName && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{sourceName}</span>
              {" \u2192 "}
              <span className="font-medium text-foreground">{targetName}</span>
            </p>
          )}
        </DialogHeader>
        <div className="grid gap-2 py-2">
          {(Object.keys(RELATIONSHIP_TYPES) as RelationshipType[]).map((t) => {
            const config = RELATIONSHIP_TYPES[t];
            return (
              <Button
                key={t}
                variant="outline"
                className="justify-start gap-3 h-auto py-3"
                onClick={() => {
                  onSelect(t);
                  onOpenChange(false);
                }}
              >
                <div
                  className="h-1 w-8 rounded-full"
                  style={{ backgroundColor: config.color }}
                />
                <div className="text-left">
                  <p className="font-medium text-sm">{config.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {config.description}
                  </p>
                </div>
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
