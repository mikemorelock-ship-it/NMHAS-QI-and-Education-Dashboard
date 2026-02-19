"use client";

import { useState } from "react";
import Link from "next/link";
import { updateDepartment, createDivision, deleteDivision } from "@/actions/departments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Trash2, Plus } from "lucide-react";

interface DepartmentData {
  id: string;
  name: string;
  type: string;
  description: string | null;
}

interface DivisionData {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

export function DepartmentEditClient({
  department,
  divisions,
}: {
  department: DepartmentData;
  divisions: DivisionData[];
}) {
  const [deleteTarget, setDeleteTarget] = useState<DivisionData | null>(null);

  const updateAction = async (formData: FormData) => {
    await updateDepartment(department.id, formData);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/departments">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-nmh-gray">Edit Department</h1>
          <p className="text-muted-foreground mt-1">
            Update department details and manage divisions.
          </p>
        </div>
      </div>

      {/* Department Edit Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-nmh-gray">Department Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={department.name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select name="type" defaultValue={department.type} required>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quality">Quality</SelectItem>
                  <SelectItem value="clinical">Clinical Development</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                  <SelectItem value="operations">Operations</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={department.description ?? ""}
                rows={3}
              />
            </div>
            <Button type="submit" className="bg-nmh-teal hover:bg-nmh-teal/90">
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Divisions Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-nmh-gray">Divisions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add Division Form */}
          <form
            action={async (formData: FormData) => {
              await createDivision(formData);
            }}
            className="flex items-end gap-3 p-4 bg-muted/50 rounded-lg"
          >
            <input type="hidden" name="departmentId" value={department.id} />
            <div className="flex-1 space-y-2">
              <Label htmlFor="divisionName">Add New Division</Label>
              <Input id="divisionName" name="name" placeholder="Division name" required />
            </div>
            <Button type="submit" size="sm" className="bg-nmh-teal hover:bg-nmh-teal/90">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </form>

          {divisions.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">
              No divisions yet. Add one above.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {divisions.map((division) => (
                  <TableRow key={division.id}>
                    <TableCell className="font-medium">{division.name}</TableCell>
                    <TableCell className="text-muted-foreground">{division.slug}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(division)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Division Confirmation */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Division</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This will also
              remove any associated data entries. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <form
              action={async () => {
                if (deleteTarget) {
                  await deleteDivision(deleteTarget.id);
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
    </div>
  );
}
