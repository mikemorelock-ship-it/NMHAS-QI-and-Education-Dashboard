"use client";

import { useState, useTransition } from "react";
import {
  createIndividual,
  updateIndividual,
  deleteIndividual,
  toggleIndividualActive,
} from "@/actions/individuals";
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
import { Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";

interface RegionRow {
  id: string;
  name: string;
  role: string | null;
  divisionId: string;
  divisionName: string;
  departmentId: string;
  departmentName: string;
  isActive: boolean;
  entriesCount: number;
}

interface DeptOption {
  id: string;
  name: string;
}

interface DivisionOption {
  id: string;
  name: string;
  departmentId: string;
}

export function ResourcesClient({
  regions,
  departments,
  divisions,
}: {
  regions: RegionRow[];
  departments: DeptOption[];
  divisions: DivisionOption[];
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RegionRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RegionRow | null>(null);
  const [filterDept, setFilterDept] = useState<string>("all");
  const [filterDiv, setFilterDiv] = useState<string>("all");
  const [isPending, startTransition] = useTransition();

  // For add/edit form state
  const [formDept, setFormDept] = useState<string>("");

  const filteredByDept =
    filterDept === "all"
      ? regions
      : regions.filter((r) => r.departmentId === filterDept);

  const filtered =
    filterDiv === "all"
      ? filteredByDept
      : filteredByDept.filter((r) => r.divisionId === filterDiv);

  const filterDivisions =
    filterDept === "all"
      ? divisions
      : divisions.filter((d) => d.departmentId === filterDept);

  const formDivisions = formDept
    ? divisions.filter((d) => d.departmentId === formDept)
    : [];

  // Group filtered regions by division for display
  const groupedByDivision = filtered.reduce<
    Record<string, { divisionName: string; departmentName: string; items: RegionRow[] }>
  >((acc, region) => {
    const key = region.divisionId;
    if (!acc[key]) {
      acc[key] = {
        divisionName: region.divisionName,
        departmentName: region.departmentName,
        items: [],
      };
    }
    acc[key].items.push(region);
    return acc;
  }, {});

  function handleFilterDeptChange(value: string) {
    setFilterDept(value);
    setFilterDiv("all");
  }

  function handleToggleActive(region: RegionRow) {
    startTransition(async () => {
      await toggleIndividualActive(region.id, !region.isActive);
    });
  }

  function openAdd() {
    setFormDept("");
    setAddOpen(true);
  }

  function openEdit(region: RegionRow) {
    setFormDept(region.departmentId);
    setEditTarget(region);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-nmh-gray">Resources</h1>
          <p className="text-muted-foreground mt-1">
            Manage regions within divisions.
          </p>
        </div>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button
              className="bg-nmh-teal hover:bg-nmh-teal/90 shrink-0 self-start sm:self-auto"
              onClick={openAdd}
            >
              <Plus className="h-4 w-4" />
              Add Region
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Region</DialogTitle>
              <DialogDescription>
                Add a new region to a division.
              </DialogDescription>
            </DialogHeader>
            <form
              action={async (formData) => {
                await createIndividual(formData);
                setAddOpen(false);
              }}
            >
              <RegionFormFields
                departments={departments}
                divisions={formDivisions}
                formDept={formDept}
                onDeptChange={setFormDept}
              />
              <DialogFooter className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-nmh-teal hover:bg-nmh-teal/90"
                >
                  Add Region
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">Department:</Label>
          <Select value={filterDept} onValueChange={handleFilterDeptChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">Division:</Label>
          <Select value={filterDiv} onValueChange={setFilterDiv}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Divisions</SelectItem>
              {filterDivisions.map((div) => (
                <SelectItem key={div.id} value={div.id}>
                  {div.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="text-xs text-muted-foreground">
          {filtered.length} of {regions.length} regions
        </span>
      </div>

      {/* Grouped Table View */}
      {Object.keys(groupedByDivision).length === 0 ? (
        <div className="bg-card rounded-lg border">
          <p className="text-muted-foreground text-sm py-8 text-center">
            No regions found. Add one to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedByDivision).map(([divId, group]) => (
            <div key={divId} className="bg-card rounded-lg border">
              <div className="px-4 py-3 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{group.divisionName}</span>
                  <Badge variant="outline" className="text-xs">
                    {group.departmentName}
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {group.items.length} {group.items.length === 1 ? "region" : "regions"}
                  </span>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Entries</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.items.map((region) => (
                    <TableRow
                      key={region.id}
                      className={!region.isActive ? "opacity-60" : undefined}
                    >
                      <TableCell className="font-medium">{region.name}</TableCell>
                      <TableCell>
                        {region.role ?? (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={region.isActive ? "default" : "secondary"}
                          className={
                            region.isActive
                              ? "bg-green-100 text-green-700 hover:bg-green-100"
                              : "bg-gray-100 text-gray-500"
                          }
                        >
                          {region.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {region.entriesCount}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            title={region.isActive ? "Deactivate" : "Activate"}
                            onClick={() => handleToggleActive(region)}
                            disabled={isPending}
                          >
                            {region.isActive ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(region)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(region)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => !open && setEditTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Region</DialogTitle>
            <DialogDescription>
              Update this region&apos;s information.
            </DialogDescription>
          </DialogHeader>
          {editTarget && (
            <form
              action={async (formData) => {
                await updateIndividual(editTarget.id, formData);
                setEditTarget(null);
              }}
            >
              <RegionFormFields
                departments={departments}
                divisions={formDivisions}
                formDept={formDept}
                onDeptChange={setFormDept}
                defaultValues={editTarget}
              />
              <DialogFooter className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditTarget(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-nmh-teal hover:bg-nmh-teal/90"
                >
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Region</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;?
              {(deleteTarget?.entriesCount ?? 0) > 0 && (
                <> This region has {deleteTarget?.entriesCount} associated data entries
                  that will have their region reference cleared.</>
              )}
              {" "}This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <form
              action={async () => {
                if (deleteTarget) {
                  await deleteIndividual(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
            >
              <Button type="submit" variant="destructive">
                Delete Region
              </Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RegionFormFields({
  departments,
  divisions,
  formDept,
  onDeptChange,
  defaultValues,
}: {
  departments: DeptOption[];
  divisions: DivisionOption[];
  formDept: string;
  onDeptChange: (value: string) => void;
  defaultValues?: RegionRow;
}) {
  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label>Department (to filter divisions)</Label>
        <Select value={formDept} onValueChange={onDeptChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select department" />
          </SelectTrigger>
          <SelectContent>
            {departments.map((dept) => (
              <SelectItem key={dept.id} value={dept.id}>
                {dept.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Division</Label>
        <Select
          name="divisionId"
          defaultValue={defaultValues?.divisionId}
          required
          disabled={!formDept}
        >
          <SelectTrigger className="w-full">
            <SelectValue
              placeholder={
                formDept ? "Select division" : "Select a department first"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {divisions.map((div) => (
              <SelectItem key={div.id} value={div.id}>
                {div.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="regionName">Region Name</Label>
        <Input
          id="regionName"
          name="name"
          defaultValue={defaultValues?.name ?? ""}
          placeholder="e.g., AC 1, Brainerd, Quality"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="regionRole">
          Type{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          id="regionRole"
          name="role"
          defaultValue={defaultValues?.role ?? ""}
          placeholder="e.g., Helicopter Unit, Base Station"
        />
      </div>
    </div>
  );
}
