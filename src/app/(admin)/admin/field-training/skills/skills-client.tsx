"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ListOrdered,
} from "lucide-react";
import {
  createSkillCategory,
  updateSkillCategory,
  deleteSkillCategory,
  createSkill,
  updateSkill,
  deleteSkill,
  createSkillStep,
  updateSkillStep,
  deleteSkillStep,
} from "@/actions/field-training";

type SkillStepData = {
  id: string;
  stepNumber: number;
  description: string;
  isRequired: boolean;
  sortOrder: number;
};

type Skill = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string | null;
  isCritical: boolean;
  sortOrder: number;
  isActive: boolean;
  signoffCount: number;
  steps: SkillStepData[];
};

type SkillCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  skills: Skill[];
};

export function SkillsClient({ categories }: { categories: SkillCategory[] }) {
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<SkillCategory | null>(null);
  const [skillDialogOpen, setSkillDialogOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [stepDialogOpen, setStepDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<SkillStepData | null>(null);
  const [stepSkillId, setStepSkillId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ---- Category handlers ----

  async function handleCatSubmit(formData: FormData) {
    setError(null);
    const result = editingCat
      ? await updateSkillCategory(editingCat.id, formData)
      : await createSkillCategory(formData);
    if (!result.success) {
      setError(result.error || "Failed to save category.");
      return;
    }
    setCatDialogOpen(false);
    setEditingCat(null);
  }

  async function handleDeleteCat(id: string) {
    if (!confirm("Are you sure you want to delete this category?")) return;
    const result = await deleteSkillCategory(id);
    if (!result.success) alert(result.error);
  }

  // ---- Skill handlers ----

  async function handleSkillSubmit(formData: FormData) {
    setError(null);
    const result = editingSkill
      ? await updateSkill(editingSkill.id, formData)
      : await createSkill(formData);
    if (!result.success) {
      setError(result.error || "Failed to save skill.");
      return;
    }
    setSkillDialogOpen(false);
    setEditingSkill(null);
  }

  async function handleDeleteSkill(id: string) {
    if (!confirm("Are you sure you want to delete this skill?")) return;
    const result = await deleteSkill(id);
    if (!result.success) alert(result.error);
  }

  // ---- Step handlers ----

  async function handleStepSubmit(formData: FormData) {
    setError(null);
    const result = editingStep
      ? await updateSkillStep(editingStep.id, formData)
      : await createSkillStep(formData);
    if (!result.success) {
      setError(result.error || "Failed to save step.");
      return;
    }
    setStepDialogOpen(false);
    setEditingStep(null);
    setStepSkillId(null);
  }

  async function handleDeleteStep(id: string) {
    if (!confirm("Delete this step?")) return;
    const result = await deleteSkillStep(id);
    if (!result.success) alert(result.error);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild aria-label="Go back">
            <Link href="/admin/field-training">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Skills Management</h1>
            <p className="text-muted-foreground">
              Manage skill categories and the skills trainees must demonstrate.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Add Category Dialog */}
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
              <Button variant="outline" size="sm">
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
                      ? "Update the skill category details."
                      : "Create a new skill category to group related skills."}
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

          {/* Add Skill Dialog */}
          <Dialog
            open={skillDialogOpen}
            onOpenChange={(open) => {
              setSkillDialogOpen(open);
              if (!open) {
                setEditingSkill(null);
                setError(null);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Skill
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form action={handleSkillSubmit}>
                <DialogHeader>
                  <DialogTitle>{editingSkill ? "Edit Skill" : "Add Skill"}</DialogTitle>
                  <DialogDescription>
                    {editingSkill
                      ? "Update the skill details."
                      : "Create a new skill that trainees must demonstrate."}
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
                    <Label htmlFor="skill-categoryId">Category</Label>
                    <Select name="categoryId" defaultValue={editingSkill?.categoryId}>
                      <SelectTrigger id="skill-categoryId">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="skill-name">Name</Label>
                    <Input id="skill-name" name="name" defaultValue={editingSkill?.name} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="skill-description">Description</Label>
                    <Textarea
                      id="skill-description"
                      name="description"
                      defaultValue={editingSkill?.description ?? ""}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="skill-sortOrder">Sort Order</Label>
                      <Input
                        id="skill-sortOrder"
                        name="sortOrder"
                        type="number"
                        defaultValue={editingSkill?.sortOrder ?? 0}
                      />
                    </div>
                    <div className="flex items-center space-x-2 pt-7">
                      <Checkbox
                        id="skill-isCritical"
                        name="isCritical"
                        defaultChecked={editingSkill?.isCritical ?? false}
                      />
                      <Label
                        htmlFor="skill-isCritical"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Critical Skill
                      </Label>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">{editingSkill ? "Update" : "Create"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {categories.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No skill categories defined yet. Add a category to get started.
          </CardContent>
        </Card>
      )}

      {categories.map((category) => (
        <Card key={category.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{category.name}</CardTitle>
              {category.description && <CardDescription>{category.description}</CardDescription>}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditingCat(category);
                  setCatDialogOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              {category.skills.length === 0 && (
                <Button variant="ghost" size="icon" onClick={() => handleDeleteCat(category.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Order</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Steps</TableHead>
                  <TableHead>Critical</TableHead>
                  <TableHead>Signoffs</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {category.skills.map((skill) => (
                  <React.Fragment key={skill.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpandedSkill(expandedSkill === skill.id ? null : skill.id)}
                    >
                      <TableCell>{skill.sortOrder}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {expandedSkill === skill.id ? (
                            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                          <div>
                            <span className="font-medium">{skill.name}</span>
                            {skill.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {skill.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          <ListOrdered className="h-3 w-3" />
                          {skill.steps.length}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {skill.isCritical && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Critical
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{skill.signoffCount}</Badge>
                      </TableCell>
                      <TableCell>
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingSkill(skill);
                              setSkillDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {skill.signoffCount === 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteSkill(skill.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedSkill === skill.id && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-muted/30 p-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-semibold">Procedure Steps</h4>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={skill.steps.length >= 20}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setStepSkillId(skill.id);
                                  setEditingStep(null);
                                  setError(null);
                                  setStepDialogOpen(true);
                                }}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add Step
                              </Button>
                            </div>
                            {skill.steps.length === 0 ? (
                              <p className="text-sm text-muted-foreground py-2">
                                No steps defined. Add steps to create a procedure checklist for this
                                skill.
                              </p>
                            ) : (
                              <ol className="space-y-2">
                                {skill.steps.map((step) => (
                                  <li
                                    key={step.id}
                                    className="flex items-start gap-3 p-2 rounded border bg-background"
                                  >
                                    <span className="font-mono text-sm font-bold text-muted-foreground w-6 shrink-0 pt-0.5">
                                      {step.stepNumber}.
                                    </span>
                                    <div className="flex-1">
                                      <p className="text-sm">{step.description}</p>
                                      {!step.isRequired && (
                                        <Badge variant="outline" className="text-[10px] mt-1">
                                          optional
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setStepSkillId(skill.id);
                                          setEditingStep(step);
                                          setError(null);
                                          setStepDialogOpen(true);
                                        }}
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteStep(step.id);
                                        }}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </li>
                                ))}
                              </ol>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
                {category.skills.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No skills in this category yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {/* Step Dialog */}
      <Dialog
        open={stepDialogOpen}
        onOpenChange={(open) => {
          setStepDialogOpen(open);
          if (!open) {
            setEditingStep(null);
            setStepSkillId(null);
            setError(null);
          }
        }}
      >
        <DialogContent>
          <form action={handleStepSubmit}>
            <DialogHeader>
              <DialogTitle>{editingStep ? "Edit Step" : "Add Step"}</DialogTitle>
              <DialogDescription>
                {editingStep
                  ? "Update the step details."
                  : "Add a new procedure step for this skill."}
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
              <input type="hidden" name="skillId" value={stepSkillId ?? ""} />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="step-number">Step Number</Label>
                  <Input
                    id="step-number"
                    name="stepNumber"
                    type="number"
                    min={1}
                    max={20}
                    defaultValue={editingStep?.stepNumber ?? ""}
                    required
                  />
                </div>
                <div className="flex items-center space-x-2 pt-7">
                  <Checkbox
                    id="step-isRequired"
                    name="isRequired"
                    defaultChecked={editingStep?.isRequired ?? true}
                  />
                  <Label htmlFor="step-isRequired" className="text-sm font-medium">
                    Required
                  </Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="step-description">Description</Label>
                <Textarea
                  id="step-description"
                  name="description"
                  defaultValue={editingStep?.description ?? ""}
                  placeholder="Describe what the FTO/trainee should do in this step..."
                  required
                />
              </div>
              <input type="hidden" name="sortOrder" value={editingStep?.sortOrder ?? 0} />
            </div>
            <DialogFooter>
              <Button type="submit">{editingStep ? "Update" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
