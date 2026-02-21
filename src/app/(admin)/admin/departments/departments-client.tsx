"use client";

import React, { useState, useTransition } from "react";
import {
  createDivisionAction,
  updateDivisionAction,
  toggleDivisionActive,
  deleteDivisionAction,
} from "@/actions/divisions";
import {
  createIndividual,
  updateIndividual,
  toggleIndividualActive,
  deleteIndividual,
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
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Building2,
  Users,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DivisionRow {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  departmentsCount: number;
  entriesCount: number;
  associationsCount: number;
}

interface DepartmentRow {
  id: string;
  divisionId: string;
  divisionName: string;
  name: string;
  role: string | null;
  isActive: boolean;
  entriesCount: number;
  associationsCount: number;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function DivisionsAndDepartmentsClient({
  divisions,
  departments,
}: {
  divisions: DivisionRow[];
  departments: DepartmentRow[];
}) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-nmh-gray">Divisions & Departments</h1>
        <p className="text-muted-foreground mt-1">
          Manage the organizational hierarchy. Divisions are top-level units; Departments are
          granular sub-units under each Division.
        </p>
      </div>

      <DivisionsSection divisions={divisions} departments={departments} />
      <DepartmentsSection departments={departments} divisions={divisions} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Divisions Section
// ---------------------------------------------------------------------------

function DivisionsSection({
  divisions,
  departments,
}: {
  divisions: DivisionRow[];
  departments: DepartmentRow[];
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DivisionRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DivisionRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const [expandedDivisions, setExpandedDivisions] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpandedDivisions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleToggleActive(div: DivisionRow) {
    startTransition(async () => {
      await toggleDivisionActive(div.id, !div.isActive);
    });
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-nmh-teal" />
          <h2 className="text-lg font-semibold text-nmh-gray">Divisions</h2>
          <Badge variant="secondary" className="ml-1">
            {divisions.length}
          </Badge>
        </div>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-nmh-teal hover:bg-nmh-teal/90">
              <Plus className="h-4 w-4" />
              Add Division
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Division</DialogTitle>
              <DialogDescription>
                Create a new top-level division (e.g., Air Care Clinical, Ground Ambulance).
              </DialogDescription>
            </DialogHeader>
            <form
              action={async (formData) => {
                const result = await createDivisionAction(formData);
                if (result.success) setAddOpen(false);
              }}
            >
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="div-name">Name</Label>
                  <Input id="div-name" name="name" placeholder="Division name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="div-sort">Sort Order</Label>
                  <Input id="div-sort" name="sortOrder" type="number" defaultValue={0} min={0} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-nmh-teal hover:bg-nmh-teal/90">
                  Create Division
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-lg border">
        {divisions.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">
            No divisions yet. Click &quot;Add Division&quot; to create one.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Departments</TableHead>
                <TableHead className="text-center">Entries</TableHead>
                <TableHead className="text-center">Associations</TableHead>
                <TableHead className="text-center">Sort</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {divisions.map((div) => {
                const isExpanded = expandedDivisions.has(div.id);
                const childDepts = departments.filter((d) => d.divisionId === div.id);
                return (
                  <React.Fragment key={div.id}>
                    <TableRow className={!div.isActive ? "opacity-60" : undefined}>
                      <TableCell className="w-8 px-2">
                        {childDepts.length > 0 ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => toggleExpand(div.id)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        ) : (
                          <span className="inline-block w-6" />
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{div.name}</span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={div.isActive ? "default" : "secondary"}
                          className={
                            div.isActive
                              ? "bg-green-100 text-green-700 hover:bg-green-100"
                              : "bg-gray-100 text-gray-500"
                          }
                        >
                          {div.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">{div.departmentsCount}</TableCell>
                      <TableCell className="text-center">{div.entriesCount}</TableCell>
                      <TableCell className="text-center">{div.associationsCount}</TableCell>
                      <TableCell className="text-center">{div.sortOrder}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            title={div.isActive ? "Deactivate" : "Activate"}
                            onClick={() => handleToggleActive(div)}
                            disabled={isPending}
                          >
                            {div.isActive ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setEditTarget(div)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(div)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {/* Expanded child departments */}
                    {isExpanded &&
                      childDepts.map((dept) => (
                        <TableRow key={`child-${dept.id}`} className="bg-muted/30">
                          <TableCell></TableCell>
                          <TableCell colSpan={2}>
                            <div className="flex items-center gap-2 pl-4">
                              <Users className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-sm">{dept.name}</span>
                              {dept.role && (
                                <Badge variant="outline" className="text-xs font-normal">
                                  {dept.role}
                                </Badge>
                              )}
                              {!dept.isActive && (
                                <Badge
                                  variant="secondary"
                                  className="bg-gray-100 text-gray-500 text-xs"
                                >
                                  Inactive
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell></TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">
                            {dept.entriesCount}
                          </TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">
                            {dept.associationsCount}
                          </TableCell>
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      ))}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Edit Division Dialog */}
      <Dialog open={editTarget !== null} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Division</DialogTitle>
            <DialogDescription>Update division details.</DialogDescription>
          </DialogHeader>
          {editTarget && (
            <form
              action={async (formData) => {
                const result = await updateDivisionAction(editTarget.id, formData);
                if (result.success) setEditTarget(null);
              }}
            >
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-div-name">Name</Label>
                  <Input id="edit-div-name" name="name" defaultValue={editTarget.name} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-div-sort">Sort Order</Label>
                  <Input
                    id="edit-div-sort"
                    name="sortOrder"
                    type="number"
                    defaultValue={editTarget.sortOrder}
                    min={0}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
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

      {/* Delete Division Dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Division</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This will also
              delete all departments under it ({deleteTarget?.departmentsCount}) and associated data
              entries ({deleteTarget?.entriesCount}). This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <form
              action={async () => {
                if (deleteTarget) {
                  await deleteDivisionAction(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
            >
              <Button type="submit" variant="destructive">
                Delete Division
              </Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Departments Section (Region in DB = "Department" in UI)
// ---------------------------------------------------------------------------

function DepartmentsSection({
  departments,
  divisions,
}: {
  departments: DepartmentRow[];
  divisions: DivisionRow[];
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DepartmentRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DepartmentRow | null>(null);
  const [filterDivision, setFilterDivision] = useState<string>("all");
  const [isPending, startTransition] = useTransition();

  const filteredDepartments =
    filterDivision === "all"
      ? departments
      : departments.filter((d) => d.divisionId === filterDivision);

  // Group departments by division for display
  const grouped = filteredDepartments.reduce(
    (acc, dept) => {
      if (!acc[dept.divisionId]) {
        acc[dept.divisionId] = {
          divisionName: dept.divisionName,
          departments: [],
        };
      }
      acc[dept.divisionId].departments.push(dept);
      return acc;
    },
    {} as Record<string, { divisionName: string; departments: DepartmentRow[] }>
  );

  function handleToggleActive(dept: DepartmentRow) {
    startTransition(async () => {
      await toggleIndividualActive(dept.id, !dept.isActive);
    });
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-nmh-orange" />
          <h2 className="text-lg font-semibold text-nmh-gray">Departments</h2>
          <Badge variant="secondary" className="ml-1">
            {departments.length}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Select value={filterDivision} onValueChange={setFilterDivision}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by Division" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Divisions</SelectItem>
              {divisions.map((div) => (
                <SelectItem key={div.id} value={div.id}>
                  {div.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-nmh-orange hover:bg-nmh-orange/90">
                <Plus className="h-4 w-4" />
                Add Department
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Department</DialogTitle>
                <DialogDescription>
                  Create a new department under a division (e.g., AC 1, Brainerd, Quality).
                </DialogDescription>
              </DialogHeader>
              <form
                action={async (formData) => {
                  const result = await createIndividual(formData);
                  if (result.success) setAddOpen(false);
                }}
              >
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="dept-division">Division</Label>
                    <Select name="divisionId" required>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select division" />
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
                    <Label htmlFor="dept-name">Name</Label>
                    <Input id="dept-name" name="name" placeholder="Department name" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dept-role">
                      Type / Role{" "}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="dept-role"
                      name="role"
                      placeholder="e.g., Helicopter Unit, Base Station"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-nmh-orange hover:bg-nmh-orange/90">
                    Create Department
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="bg-card rounded-lg border">
        {filteredDepartments.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">
            {departments.length === 0
              ? 'No departments yet. Click "Add Department" to create one.'
              : "No departments match the selected filter."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Division</TableHead>
                <TableHead>Type / Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Entries</TableHead>
                <TableHead className="text-center">Associations</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(grouped).map(([, { divisionName, departments: depts }]) =>
                depts.map((dept, idx) => (
                  <TableRow key={dept.id} className={!dept.isActive ? "opacity-60" : undefined}>
                    <TableCell>
                      <span className="font-medium">{dept.name}</span>
                    </TableCell>
                    <TableCell>
                      {idx === 0 ? (
                        <Badge
                          variant="outline"
                          className="text-xs bg-nmh-teal/5 text-nmh-teal border-nmh-teal/20"
                        >
                          {divisionName}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">{divisionName}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {dept.role ? (
                        <span className="text-sm text-muted-foreground">{dept.role}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={dept.isActive ? "default" : "secondary"}
                        className={
                          dept.isActive
                            ? "bg-green-100 text-green-700 hover:bg-green-100"
                            : "bg-gray-100 text-gray-500"
                        }
                      >
                        {dept.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{dept.entriesCount}</TableCell>
                    <TableCell className="text-center">{dept.associationsCount}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          title={dept.isActive ? "Deactivate" : "Activate"}
                          onClick={() => handleToggleActive(dept)}
                          disabled={isPending}
                        >
                          {dept.isActive ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setEditTarget(dept)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(dept)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Edit Department Dialog */}
      <Dialog open={editTarget !== null} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
            <DialogDescription>Update department details.</DialogDescription>
          </DialogHeader>
          {editTarget && (
            <form
              action={async (formData) => {
                const result = await updateIndividual(editTarget.id, formData);
                if (result.success) setEditTarget(null);
              }}
            >
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-dept-division">Division</Label>
                  <Select name="divisionId" defaultValue={editTarget.divisionId} required>
                    <SelectTrigger className="w-full">
                      <SelectValue />
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
                  <Label htmlFor="edit-dept-name">Name</Label>
                  <Input id="edit-dept-name" name="name" defaultValue={editTarget.name} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-dept-role">
                    Type / Role{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="edit-dept-role"
                    name="role"
                    defaultValue={editTarget.role ?? ""}
                    placeholder="e.g., Helicopter Unit, Base Station"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-nmh-orange hover:bg-nmh-orange/90">
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Department Dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Department</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This will also
              delete {deleteTarget?.entriesCount ?? 0} data entries and{" "}
              {deleteTarget?.associationsCount ?? 0} metric associations. This action cannot be
              undone.
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
                Delete Department
              </Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
