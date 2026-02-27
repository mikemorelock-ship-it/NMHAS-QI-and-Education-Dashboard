"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

interface ImportOrgDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (options: {
    divisions: boolean;
    departments: boolean;
    users: boolean;
  }) => Promise<void>;
  divisionCount: number;
  departmentCount: number;
  userCount: number;
}

export function ImportOrgDataDialog({
  open,
  onOpenChange,
  onImport,
  divisionCount,
  departmentCount,
  userCount,
}: ImportOrgDataDialogProps) {
  const [divisions, setDivisions] = useState(true);
  const [departments, setDepartments] = useState(true);
  const [users, setUsers] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    if (!divisions && !departments && !users) return;
    setLoading(true);
    await onImport({ divisions, departments, users });
    setLoading(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import from Organization Data</DialogTitle>
          <DialogDescription>
            Seed this map with nodes from your existing organizational data. Already-imported
            entities will be skipped.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="import-divisions"
              checked={divisions}
              onCheckedChange={(v) => setDivisions(v === true)}
            />
            <div>
              <Label htmlFor="import-divisions" className="font-medium">
                Divisions
              </Label>
              <p className="text-xs text-muted-foreground">
                {divisionCount} active division{divisionCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="import-departments"
              checked={departments}
              onCheckedChange={(v) => setDepartments(v === true)}
            />
            <div>
              <Label htmlFor="import-departments" className="font-medium">
                Departments
              </Label>
              <p className="text-xs text-muted-foreground">
                {departmentCount} active department
                {departmentCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="import-users"
              checked={users}
              onCheckedChange={(v) => setUsers(v === true)}
            />
            <div>
              <Label htmlFor="import-users" className="font-medium">
                Users / Individuals
              </Label>
              <p className="text-xs text-muted-foreground">
                {userCount} active user{userCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={(!divisions && !departments && !users) || loading}
          >
            {loading ? "Importing..." : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
