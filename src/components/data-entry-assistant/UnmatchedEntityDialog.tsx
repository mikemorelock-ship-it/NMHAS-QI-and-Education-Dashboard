"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, MapPin, Plus, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { createRegionInline } from "@/actions/data-entry-assistant";
import type { DataEntryContext, ProposedEntry, UnmatchedEntity } from "@/lib/data-entry-ai";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ResolutionAction = "map" | "create" | "skip";

interface EntityResolution {
  action: ResolutionAction;
  /** For "map": the chosen existing entity ID */
  mappedId?: string;
  /** For "map": the resolved name (for display in entries) */
  mappedName?: string;
  /** For "map" region: the division ID of the mapped region */
  mappedDivisionId?: string;
  /** For "create": the parent division ID */
  createDivisionId?: string;
  /** For "create": the new entity name */
  createName?: string;
}

interface UnmatchedEntityDialogProps {
  open: boolean;
  unmatched: UnmatchedEntity[];
  entries: ProposedEntry[];
  context: DataEntryContext;
  onResolved: (resolvedEntries: ProposedEntry[], updatedContext: DataEntryContext) => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function entityKey(entity: UnmatchedEntity): string {
  return `${entity.entityType}::${entity.originalName.toLowerCase().trim()}`;
}

export function UnmatchedEntityDialog({
  open,
  unmatched,
  entries,
  context,
  onResolved,
  onCancel,
}: UnmatchedEntityDialogProps) {
  const [resolutions, setResolutions] = useState<Map<string, EntityResolution>>(() => {
    const map = new Map<string, EntityResolution>();
    for (const entity of unmatched) {
      map.set(entityKey(entity), { action: "skip" });
    }
    return map;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateResolution(key: string, update: Partial<EntityResolution>) {
    setResolutions((prev) => {
      const next = new Map(prev);
      const current = next.get(key) ?? { action: "skip" as ResolutionAction };
      next.set(key, { ...current, ...update });
      return next;
    });
  }

  // Group regions by division for the "map to existing" select
  const regionsByDivision = new Map<
    string,
    { divisionName: string; regions: typeof context.regions }
  >();
  for (const region of context.regions) {
    const division = context.divisions.find((d) => d.id === region.divisionId);
    const divName = division?.name ?? "Unknown";
    if (!regionsByDivision.has(region.divisionId)) {
      regionsByDivision.set(region.divisionId, { divisionName: divName, regions: [] });
    }
    regionsByDivision.get(region.divisionId)!.regions.push(region);
  }

  const totalAffected = unmatched.reduce((sum, e) => sum + e.affectedEntryIndices.length, 0);

  async function handleApply() {
    setSaving(true);
    setError(null);

    try {
      const updatedEntries = [...entries];
      const newRegions: { id: string; name: string; divisionId: string }[] = [];

      for (const entity of unmatched) {
        const key = entityKey(entity);
        const resolution = resolutions.get(key);
        if (!resolution || resolution.action === "skip") continue;

        if (resolution.action === "map" && resolution.mappedId) {
          // Patch affected entries with the mapped ID
          for (const idx of entity.affectedEntryIndices) {
            if (idx >= updatedEntries.length) continue;
            const patched = { ...updatedEntries[idx] };
            if (entity.entityType === "division") {
              patched.divisionId = resolution.mappedId;
              patched.divisionName = resolution.mappedName ?? null;
            } else {
              patched.regionId = resolution.mappedId;
              patched.regionName = resolution.mappedName ?? null;
              // Also set the division if available
              if (resolution.mappedDivisionId) {
                patched.divisionId = resolution.mappedDivisionId;
                const div = context.divisions.find((d) => d.id === resolution.mappedDivisionId);
                if (div) patched.divisionName = div.name;
              }
            }
            updatedEntries[idx] = patched;
          }
        } else if (
          resolution.action === "create" &&
          resolution.createDivisionId &&
          resolution.createName?.trim()
        ) {
          // Create new region
          const result = await createRegionInline(
            resolution.createName.trim(),
            resolution.createDivisionId
          );
          if (!result.success) {
            setError(`Failed to create "${resolution.createName}": ${result.error}`);
            setSaving(false);
            return;
          }

          const newRegion = result.region;
          newRegions.push(newRegion);

          // Patch affected entries
          for (const idx of entity.affectedEntryIndices) {
            if (idx >= updatedEntries.length) continue;
            const patched = { ...updatedEntries[idx] };
            patched.regionId = newRegion.id;
            patched.regionName = newRegion.name;
            patched.divisionId = newRegion.divisionId;
            const div = context.divisions.find((d) => d.id === newRegion.divisionId);
            if (div) patched.divisionName = div.name;
            updatedEntries[idx] = patched;
          }
        }
      }

      // Build updated context with new regions
      const updatedContext: DataEntryContext = {
        ...context,
        regions: [...context.regions, ...newRegions],
      };

      onResolved(updatedEntries, updatedContext);
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setSaving(false);
    }
  }

  function handleSkipAll() {
    onCancel();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onCancel();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Resolve Unrecognized Names
          </DialogTitle>
          <DialogDescription>
            {unmatched.length} unrecognized {unmatched.length === 1 ? "name" : "names"} found
            affecting {totalAffected} {totalAffected === 1 ? "entry" : "entries"}. Map each to an
            existing region, create a new one, or skip.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {unmatched.map((entity, i) => {
            const key = entityKey(entity);
            const resolution = resolutions.get(key) ?? { action: "skip" as ResolutionAction };

            return (
              <div key={key}>
                {i > 0 && <Separator className="mb-4" />}
                <div className="space-y-3">
                  {/* Entity header */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">&ldquo;{entity.originalName}&rdquo;</span>
                    <Badge variant="outline" className="text-[10px]">
                      {entity.entityType}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      ({entity.affectedEntryIndices.length}{" "}
                      {entity.affectedEntryIndices.length === 1 ? "entry" : "entries"})
                    </span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-1.5">
                    <Button
                      variant={resolution.action === "map" ? "default" : "outline"}
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => updateResolution(key, { action: "map" })}
                    >
                      <MapPin className="h-3 w-3 mr-1" />
                      Map to existing
                    </Button>
                    {entity.entityType === "region" && (
                      <Button
                        variant={resolution.action === "create" ? "default" : "outline"}
                        size="sm"
                        className="text-xs h-7"
                        onClick={() =>
                          updateResolution(key, {
                            action: "create",
                            createName: entity.originalName,
                          })
                        }
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Create new
                      </Button>
                    )}
                    <Button
                      variant={resolution.action === "skip" ? "default" : "outline"}
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => updateResolution(key, { action: "skip" })}
                    >
                      <SkipForward className="h-3 w-3 mr-1" />
                      Skip
                    </Button>
                  </div>

                  {/* Map to existing — select */}
                  {resolution.action === "map" && entity.entityType === "division" && (
                    <div className="pl-4">
                      <Label className="text-xs text-muted-foreground">Select division</Label>
                      <Select
                        value={resolution.mappedId ?? ""}
                        onValueChange={(val) => {
                          const div = context.divisions.find((d) => d.id === val);
                          updateResolution(key, {
                            mappedId: val,
                            mappedName: div?.name,
                          });
                        }}
                      >
                        <SelectTrigger className="mt-1 h-8 text-xs">
                          <SelectValue placeholder="Choose a division..." />
                        </SelectTrigger>
                        <SelectContent>
                          {context.divisions.map((d) => (
                            <SelectItem key={d.id} value={d.id} className="text-xs">
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {resolution.action === "map" && entity.entityType === "region" && (
                    <div className="pl-4">
                      <Label className="text-xs text-muted-foreground">Select region</Label>
                      <Select
                        value={resolution.mappedId ?? ""}
                        onValueChange={(val) => {
                          const region = context.regions.find((r) => r.id === val);
                          updateResolution(key, {
                            mappedId: val,
                            mappedName: region?.name,
                            mappedDivisionId: region?.divisionId,
                          });
                        }}
                      >
                        <SelectTrigger className="mt-1 h-8 text-xs">
                          <SelectValue placeholder="Choose a region..." />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from(regionsByDivision.entries()).map(([divId, group]) => (
                            <SelectGroup key={divId}>
                              <SelectLabel className="text-[10px]">
                                {group.divisionName}
                              </SelectLabel>
                              {group.regions.map((r) => (
                                <SelectItem key={r.id} value={r.id} className="text-xs">
                                  {r.name}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Create new region */}
                  {resolution.action === "create" && entity.entityType === "region" && (
                    <div className="pl-4 space-y-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Parent division</Label>
                        <Select
                          value={resolution.createDivisionId ?? ""}
                          onValueChange={(val) => updateResolution(key, { createDivisionId: val })}
                        >
                          <SelectTrigger className="mt-1 h-8 text-xs">
                            <SelectValue placeholder="Choose a division..." />
                          </SelectTrigger>
                          <SelectContent>
                            {context.divisions.map((d) => (
                              <SelectItem key={d.id} value={d.id} className="text-xs">
                                {d.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Region name</Label>
                        <Input
                          className="mt-1 h-8 text-xs"
                          value={resolution.createName ?? ""}
                          onChange={(e) => updateResolution(key, { createName: e.target.value })}
                          placeholder="e.g., St. Cloud"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={handleSkipAll} disabled={saving}>
            Skip All
          </Button>
          <Button size="sm" onClick={handleApply} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                Applying...
              </>
            ) : (
              "Apply Resolutions"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
