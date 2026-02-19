"use client";

import { useState } from "react";
import Link from "next/link";
import {
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
  createResource,
  updateResource,
  deleteResource,
  createResponsibleParty,
  updateResponsibleParty,
  deleteResponsibleParty,
} from "@/actions/metric-detail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { ArrowLeft, Plus, Pencil, Trash2, Activity, BookOpen, User } from "lucide-react";
import { ANNOTATION_TYPES, RESOURCE_TYPES } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AnnotationRow {
  id: string;
  metricDefinitionId: string;
  date: string;
  title: string;
  description: string | null;
  type: "intervention" | "milestone" | "event";
}

interface ResourceRow {
  id: string;
  metricDefinitionId: string;
  title: string;
  url: string;
  type: "document" | "link" | "reference" | "protocol";
  sortOrder: number;
}

interface ResponsiblePartyRow {
  id: string;
  metricDefinitionId: string;
  name: string;
  role: string;
  email: string | null;
  sortOrder: number;
}

interface MetricDetailAdminClientProps {
  metric: { id: string; name: string; departmentName: string };
  annotations: AnnotationRow[];
  resources: ResourceRow[];
  responsibleParties: ResponsiblePartyRow[];
}

// ---------------------------------------------------------------------------
// Annotation type badge colors
// ---------------------------------------------------------------------------

const ANNOTATION_BADGE: Record<string, string> = {
  intervention: "bg-[#00b0ad]/10 text-[#00b0ad] border-[#00b0ad]/20",
  milestone: "bg-[#e04726]/10 text-[#e04726] border-[#e04726]/20",
  event: "bg-[#4b4f54]/10 text-[#4b4f54] border-[#4b4f54]/20",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MetricDetailAdminClient({
  metric,
  annotations,
  resources,
  responsibleParties,
}: MetricDetailAdminClientProps) {
  // Annotation state
  const [addAnnotationOpen, setAddAnnotationOpen] = useState(false);
  const [editAnnotation, setEditAnnotation] = useState<AnnotationRow | null>(null);
  const [deleteAnnotationTarget, setDeleteAnnotationTarget] = useState<AnnotationRow | null>(null);

  // Resource state
  const [addResourceOpen, setAddResourceOpen] = useState(false);
  const [editResource, setEditResource] = useState<ResourceRow | null>(null);
  const [deleteResourceTarget, setDeleteResourceTarget] = useState<ResourceRow | null>(null);

  // Responsible party state
  const [addPartyOpen, setAddPartyOpen] = useState(false);
  const [editParty, setEditParty] = useState<ResponsiblePartyRow | null>(null);
  const [deletePartyTarget, setDeletePartyTarget] = useState<ResponsiblePartyRow | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/metrics">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-nmh-gray">Manage: {metric.name}</h1>
          <p className="text-muted-foreground mt-1">
            {metric.departmentName} — Annotations, resources, and responsible parties.
          </p>
        </div>
      </div>

      {/* =================================================================== */}
      {/* ANNOTATIONS SECTION                                                 */}
      {/* =================================================================== */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-nmh-gray flex items-center gap-2">
            <Activity className="h-5 w-5" />
            QI Annotations
          </CardTitle>
          <Button
            size="sm"
            className="bg-nmh-teal hover:bg-nmh-teal/90"
            onClick={() => setAddAnnotationOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add Annotation
          </Button>
        </CardHeader>
        <CardContent>
          {annotations.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">
              No annotations yet. Add QI interventions, milestones, or events.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {annotations.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-nowrap">{a.date}</TableCell>
                    <TableCell className="font-medium">{a.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={ANNOTATION_BADGE[a.type] || ""}>
                        {a.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {a.description || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => setEditAnnotation(a)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteAnnotationTarget(a)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Annotation Dialog */}
      <Dialog open={addAnnotationOpen} onOpenChange={setAddAnnotationOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Annotation</DialogTitle>
            <DialogDescription>
              Record a QI intervention, milestone, or notable event.
            </DialogDescription>
          </DialogHeader>
          <form
            action={async (formData) => {
              await createAnnotation(formData);
              setAddAnnotationOpen(false);
            }}
          >
            <input type="hidden" name="metricDefinitionId" value={metric.id} />
            <AnnotationFormFields />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setAddAnnotationOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-nmh-teal hover:bg-nmh-teal/90">
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Annotation Dialog */}
      <Dialog
        open={editAnnotation !== null}
        onOpenChange={(open) => !open && setEditAnnotation(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Annotation</DialogTitle>
            <DialogDescription>Update this annotation.</DialogDescription>
          </DialogHeader>
          {editAnnotation && (
            <form
              action={async (formData) => {
                await updateAnnotation(editAnnotation.id, formData);
                setEditAnnotation(null);
              }}
            >
              <input type="hidden" name="metricDefinitionId" value={metric.id} />
              <AnnotationFormFields defaults={editAnnotation} />
              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setEditAnnotation(null)}>
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

      {/* Delete Annotation Confirmation */}
      <Dialog
        open={deleteAnnotationTarget !== null}
        onOpenChange={(open) => !open && setDeleteAnnotationTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Annotation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteAnnotationTarget?.title}&quot;? This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAnnotationTarget(null)}>
              Cancel
            </Button>
            <form
              action={async () => {
                if (deleteAnnotationTarget) {
                  await deleteAnnotation(deleteAnnotationTarget.id);
                  setDeleteAnnotationTarget(null);
                }
              }}
            >
              <Button type="submit" variant="destructive">
                Delete
              </Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* RESOURCES SECTION                                                   */}
      {/* =================================================================== */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-nmh-gray flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Resources
          </CardTitle>
          <Button
            size="sm"
            className="bg-nmh-teal hover:bg-nmh-teal/90"
            onClick={() => setAddResourceOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add Resource
          </Button>
        </CardHeader>
        <CardContent>
          {resources.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">
              No resources yet. Add links to protocols, documents, or references.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resources.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {r.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-[#00b0ad]"
                      >
                        {r.url}
                      </a>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => setEditResource(r)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteResourceTarget(r)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Resource Dialog */}
      <Dialog open={addResourceOpen} onOpenChange={setAddResourceOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Resource</DialogTitle>
            <DialogDescription>Add a link to a document, protocol, or reference.</DialogDescription>
          </DialogHeader>
          <form
            action={async (formData) => {
              await createResource(formData);
              setAddResourceOpen(false);
            }}
          >
            <input type="hidden" name="metricDefinitionId" value={metric.id} />
            <ResourceFormFields />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setAddResourceOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-nmh-teal hover:bg-nmh-teal/90">
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Resource Dialog */}
      <Dialog open={editResource !== null} onOpenChange={(open) => !open && setEditResource(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Resource</DialogTitle>
            <DialogDescription>Update this resource.</DialogDescription>
          </DialogHeader>
          {editResource && (
            <form
              action={async (formData) => {
                await updateResource(editResource.id, formData);
                setEditResource(null);
              }}
            >
              <input type="hidden" name="metricDefinitionId" value={metric.id} />
              <ResourceFormFields defaults={editResource} />
              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setEditResource(null)}>
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

      {/* Delete Resource Confirmation */}
      <Dialog
        open={deleteResourceTarget !== null}
        onOpenChange={(open) => !open && setDeleteResourceTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Resource</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteResourceTarget?.title}&quot;? This cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteResourceTarget(null)}>
              Cancel
            </Button>
            <form
              action={async () => {
                if (deleteResourceTarget) {
                  await deleteResource(deleteResourceTarget.id);
                  setDeleteResourceTarget(null);
                }
              }}
            >
              <Button type="submit" variant="destructive">
                Delete
              </Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* RESPONSIBLE PARTIES SECTION                                         */}
      {/* =================================================================== */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-nmh-gray flex items-center gap-2">
            <User className="h-5 w-5" />
            Responsible Parties
          </CardTitle>
          <Button
            size="sm"
            className="bg-nmh-teal hover:bg-nmh-teal/90"
            onClick={() => setAddPartyOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add Person
          </Button>
        </CardHeader>
        <CardContent>
          {responsibleParties.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">
              No responsible parties assigned yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {responsibleParties.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.role}</TableCell>
                    <TableCell className="text-muted-foreground">{p.email || "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => setEditParty(p)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeletePartyTarget(p)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Party Dialog */}
      <Dialog open={addPartyOpen} onOpenChange={setAddPartyOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Responsible Party</DialogTitle>
            <DialogDescription>Add a person responsible for this metric.</DialogDescription>
          </DialogHeader>
          <form
            action={async (formData) => {
              await createResponsibleParty(formData);
              setAddPartyOpen(false);
            }}
          >
            <input type="hidden" name="metricDefinitionId" value={metric.id} />
            <PartyFormFields />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setAddPartyOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-nmh-teal hover:bg-nmh-teal/90">
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Party Dialog */}
      <Dialog open={editParty !== null} onOpenChange={(open) => !open && setEditParty(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Responsible Party</DialogTitle>
            <DialogDescription>Update this person&apos;s details.</DialogDescription>
          </DialogHeader>
          {editParty && (
            <form
              action={async (formData) => {
                await updateResponsibleParty(editParty.id, formData);
                setEditParty(null);
              }}
            >
              <input type="hidden" name="metricDefinitionId" value={metric.id} />
              <PartyFormFields defaults={editParty} />
              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setEditParty(null)}>
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

      {/* Delete Party Confirmation */}
      <Dialog
        open={deletePartyTarget !== null}
        onOpenChange={(open) => !open && setDeletePartyTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Responsible Party</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove &quot;{deletePartyTarget?.name}&quot;? This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletePartyTarget(null)}>
              Cancel
            </Button>
            <form
              action={async () => {
                if (deletePartyTarget) {
                  await deleteResponsibleParty(deletePartyTarget.id);
                  setDeletePartyTarget(null);
                }
              }}
            >
              <Button type="submit" variant="destructive">
                Delete
              </Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form Fields
// ---------------------------------------------------------------------------

function AnnotationFormFields({ defaults }: { defaults?: AnnotationRow }) {
  return (
    <div className="space-y-4 py-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input id="date" name="date" type="date" defaultValue={defaults?.date ?? ""} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <Select name="type" defaultValue={defaults?.type ?? "intervention"} required>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ANNOTATION_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="capitalize">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          defaultValue={defaults?.title ?? ""}
          placeholder="Brief description of the event"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={defaults?.description ?? ""}
          placeholder="More details about this annotation"
          rows={3}
        />
      </div>
    </div>
  );
}

function ResourceFormFields({ defaults }: { defaults?: ResourceRow }) {
  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          defaultValue={defaults?.title ?? ""}
          placeholder="Resource title"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="url">URL</Label>
        <Input
          id="url"
          name="url"
          type="url"
          defaultValue={defaults?.url ?? ""}
          placeholder="https://..."
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <Select name="type" defaultValue={defaults?.type ?? "link"} required>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESOURCE_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="capitalize">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sortOrder">Sort Order</Label>
          <Input
            id="sortOrder"
            name="sortOrder"
            type="number"
            defaultValue={defaults?.sortOrder ?? 0}
            min={0}
          />
        </div>
      </div>
    </div>
  );
}

function PartyFormFields({ defaults }: { defaults?: ResponsiblePartyRow }) {
  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={defaults?.name ?? ""}
          placeholder="Full name"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <Input
          id="role"
          name="role"
          defaultValue={defaults?.role ?? ""}
          placeholder="e.g., Medical Director, QI Coordinator"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email (optional)</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={defaults?.email ?? ""}
            placeholder="email@example.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sortOrder">Sort Order</Label>
          <Input
            id="sortOrder"
            name="sortOrder"
            type="number"
            defaultValue={defaults?.sortOrder ?? 0}
            min={0}
          />
        </div>
      </div>
    </div>
  );
}
