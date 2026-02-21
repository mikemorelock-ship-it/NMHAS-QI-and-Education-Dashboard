"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, ArrowLeft } from "lucide-react";
import {
  createPhase,
  updatePhase,
  deletePhase,
  createEvaluationCategory,
  updateEvaluationCategory,
  deleteEvaluationCategory,
} from "@/actions/field-training";

type Phase = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  minDays: number | null;
  isActive: boolean;
  usageCount: number;
};

type EvalCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  usageCount: number;
};

export function SettingsClient({
  phases,
  evalCategories,
}: {
  phases: Phase[];
  evalCategories: EvalCategory[];
}) {
  const [phaseDialogOpen, setPhaseDialogOpen] = useState(false);
  const [editingPhase, setEditingPhase] = useState<Phase | null>(null);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<EvalCategory | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePhaseSubmit(formData: FormData) {
    setError(null);
    const result = editingPhase
      ? await updatePhase(editingPhase.id, formData)
      : await createPhase(formData);
    if (!result.success) {
      setError(result.error || "Failed to save phase.");
      return;
    }
    setPhaseDialogOpen(false);
    setEditingPhase(null);
  }

  async function handleDeletePhase(id: string) {
    if (!confirm("Are you sure you want to delete this phase?")) return;
    const result = await deletePhase(id);
    if (!result.success) alert(result.error);
  }

  async function handleCatSubmit(formData: FormData) {
    setError(null);
    const result = editingCat
      ? await updateEvaluationCategory(editingCat.id, formData)
      : await createEvaluationCategory(formData);
    if (!result.success) {
      setError(result.error || "Failed to save category.");
      return;
    }
    setCatDialogOpen(false);
    setEditingCat(null);
  }

  async function handleDeleteCat(id: string) {
    if (!confirm("Are you sure you want to delete this category?")) return;
    const result = await deleteEvaluationCategory(id);
    if (!result.success) alert(result.error);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild aria-label="Go back">
          <Link href="/admin/field-training">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Field Training Settings</h1>
          <p className="text-muted-foreground">
            Manage training phases and DOR performance categories.
          </p>
        </div>
      </div>

      {/* Training Phases */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Training Phases</CardTitle>
            <CardDescription>
              Define the phases trainees progress through during field training.
            </CardDescription>
          </div>
          <Dialog
            open={phaseDialogOpen}
            onOpenChange={(open) => {
              setPhaseDialogOpen(open);
              if (!open) {
                setEditingPhase(null);
                setError(null);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Phase
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form action={handlePhaseSubmit}>
                <DialogHeader>
                  <DialogTitle>{editingPhase ? "Edit Phase" : "Add Phase"}</DialogTitle>
                  <DialogDescription>
                    {editingPhase
                      ? "Update the training phase details."
                      : "Create a new training phase."}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div aria-live="polite">
                    {error && (
                      <p className="text-sm text-destructive" role="alert">
                        {error}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" name="name" defaultValue={editingPhase?.name} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      name="description"
                      defaultValue={editingPhase?.description ?? ""}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sortOrder">Sort Order</Label>
                      <Input
                        id="sortOrder"
                        name="sortOrder"
                        type="number"
                        defaultValue={editingPhase?.sortOrder ?? 0}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="minDays">Min Days</Label>
                      <Input
                        id="minDays"
                        name="minDays"
                        type="number"
                        defaultValue={editingPhase?.minDays ?? ""}
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">{editingPhase ? "Update" : "Create"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Min Days</TableHead>
                <TableHead>Trainees</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {phases.map((phase) => (
                <TableRow key={phase.id}>
                  <TableCell>{phase.sortOrder}</TableCell>
                  <TableCell>
                    <div>
                      <span className="font-medium">{phase.name}</span>
                      {phase.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{phase.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{phase.minDays ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{phase.usageCount}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingPhase(phase);
                          setPhaseDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {phase.usageCount === 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeletePhase(phase.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {phases.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No training phases defined yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* DOR Performance Categories */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>DOR Performance Categories</CardTitle>
            <CardDescription>
              Categories used for rating trainees on daily evaluations.
            </CardDescription>
          </div>
          <Dialog
            open={catDialogOpen}
            onOpenChange={(open) => {
              setCatDialogOpen(open);
              if (!open) {
                setEditingCat(null);
                setError(null);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form action={handleCatSubmit}>
                <DialogHeader>
                  <DialogTitle>{editingCat ? "Edit Category" : "Add Category"}</DialogTitle>
                  <DialogDescription>
                    {editingCat
                      ? "Update the DOR performance category."
                      : "Create a new DOR performance category."}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div aria-live="polite">
                    {error && (
                      <p className="text-sm text-destructive" role="alert">
                        {error}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cat-name">Name</Label>
                    <Input id="cat-name" name="name" defaultValue={editingCat?.name} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cat-description">Description</Label>
                    <Textarea
                      id="cat-description"
                      name="description"
                      defaultValue={editingCat?.description ?? ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cat-sortOrder">Sort Order</Label>
                    <Input
                      id="cat-sortOrder"
                      name="sortOrder"
                      type="number"
                      defaultValue={editingCat?.sortOrder ?? 0}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">{editingCat ? "Update" : "Create"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Ratings</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evalCategories.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell>{cat.sortOrder}</TableCell>
                  <TableCell>
                    <div>
                      <span className="font-medium">{cat.name}</span>
                      {cat.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{cat.usageCount}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingCat(cat);
                          setCatDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {cat.usageCount === 0 && (
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteCat(cat.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {evalCategories.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No DOR performance categories defined yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
