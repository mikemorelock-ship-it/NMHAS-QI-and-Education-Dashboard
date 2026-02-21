"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Markdown from "react-markdown";
import {
  Sparkles,
  Plus,
  Eye,
  Pencil,
  Trash2,
  Check,
  X,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Loader2,
  BookOpen,
  MessageSquare,
  HelpCircle,
  Gamepad2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  createCoachingActivity,
  updateCoachingActivity,
  deleteCoachingActivity,
  approveCoachingActivity,
  rejectCoachingActivity,
  bulkApproveActivities,
  toggleCoachingActivityActive,
  generateCoachingActivitiesAction,
} from "@/actions/coaching-admin";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Activity {
  id: string;
  title: string;
  description: string | null;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  type: string;
  content: string | null;
  difficulty: string;
  estimatedMins: number;
  isActive: boolean;
  generationStatus: string;
  generatedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  sourceDocument: { id: string; title: string } | null;
  assignmentCount: number;
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

interface ResourceDoc {
  id: string;
  title: string;
  fileName: string;
  fileType: string;
  textLength: number;
}

interface Props {
  activities: Activity[];
  categories: Category[];
  documents: ResourceDoc[];
  aiConfigured: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_ICONS: Record<string, typeof BookOpen> = {
  reading: BookOpen,
  reflection: MessageSquare,
  quiz: HelpCircle,
  scenario: Gamepad2,
};

const DIFFICULTY_COLORS: Record<string, string> = {
  basic: "bg-green-100 text-green-800",
  intermediate: "bg-yellow-100 text-yellow-800",
  advanced: "bg-red-100 text-red-800",
};

const STATUS_BADGES: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  manual: { label: "Manual", variant: "outline" },
  draft: { label: "Draft", variant: "secondary" },
  approved: { label: "Approved", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
};

// Default form data for create/edit
function defaultFormData() {
  return {
    title: "",
    description: "",
    categoryId: "",
    type: "reading",
    content: "",
    difficulty: "basic",
    estimatedMins: 10,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CoachingAdminClient({ activities, categories, documents, aiConfigured }: Props) {
  const router = useRouter();

  // Filters
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSearch, setFilterSearch] = useState("");

  // Create/Edit dialog
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(defaultFormData());

  // Preview dialog
  const [previewActivity, setPreviewActivity] = useState<Activity | null>(null);

  // AI Generator dialog
  const [showGenerator, setShowGenerator] = useState(false);
  const [genDocId, setGenDocId] = useState("");
  const [genItems, setGenItems] = useState<
    Array<{ categoryId: string; activityType: string; difficulty: string }>
  >([]);
  const [genInstructions, setGenInstructions] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genResults, setGenResults] = useState<{
    generated: number;
    failed: number;
    errors: string[];
  } | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Processing
  const [processing, setProcessing] = useState<string | null>(null);

  // ---------- Computed ----------

  const filteredActivities = activities.filter((a) => {
    if (filterCategory !== "all" && a.categoryId !== filterCategory) return false;
    if (filterType !== "all" && a.type !== filterType) return false;
    if (filterStatus !== "all" && a.generationStatus !== filterStatus) return false;
    if (filterSearch && !a.title.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: activities.length,
    active: activities.filter((a) => a.isActive).length,
    drafts: activities.filter((a) => a.generationStatus === "draft").length,
    aiGenerated: activities.filter((a) => a.generationStatus !== "manual").length,
  };

  const draftIds = filteredActivities
    .filter((a) => a.generationStatus === "draft")
    .map((a) => a.id);

  // ---------- Create / Edit ----------

  const openCreate = () => {
    setEditingId(null);
    setFormData(defaultFormData());
    setShowForm(true);
  };

  const openEdit = (a: Activity) => {
    setEditingId(a.id);
    setFormData({
      title: a.title,
      description: a.description || "",
      categoryId: a.categoryId,
      type: a.type,
      content: a.content || "",
      difficulty: a.difficulty,
      estimatedMins: a.estimatedMins,
    });
    setShowForm(true);
  };

  const saveForm = async () => {
    if (!formData.title || !formData.categoryId) {
      alert("Title and category are required.");
      return;
    }
    setProcessing("form");
    if (editingId) {
      const result = await updateCoachingActivity(editingId, formData);
      if (!result.success) alert(result.error);
    } else {
      const result = await createCoachingActivity(formData);
      if (!result.success) alert(result.error);
    }
    setShowForm(false);
    setProcessing(null);
    router.refresh();
  };

  // ---------- Delete ----------

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this coaching activity?")) return;
    setProcessing(id);
    const result = await deleteCoachingActivity(id);
    if (!result.success) alert(result.error);
    setProcessing(null);
    router.refresh();
  };

  // ---------- Approve / Reject ----------

  const handleApprove = async (id: string) => {
    setProcessing(id);
    const result = await approveCoachingActivity(id);
    if (!result.success) alert(result.error);
    setProcessing(null);
    router.refresh();
  };

  const handleReject = async (id: string) => {
    const notes = prompt("Rejection notes (optional):");
    if (notes === null) return; // cancelled
    setProcessing(id);
    const result = await rejectCoachingActivity(id, notes);
    if (!result.success) alert(result.error);
    setProcessing(null);
    router.refresh();
  };

  const handleBulkApprove = async () => {
    const ids = [...selectedIds].filter(
      (id) => activities.find((a) => a.id === id)?.generationStatus === "draft"
    );
    if (ids.length === 0) return;
    if (!confirm(`Approve ${ids.length} draft activities?`)) return;
    setProcessing("bulk");
    const result = await bulkApproveActivities(ids);
    if (!result.success) alert(result.error);
    setSelectedIds(new Set());
    setProcessing(null);
    router.refresh();
  };

  // ---------- Toggle Active ----------

  const handleToggleActive = async (id: string) => {
    setProcessing(id);
    const result = await toggleCoachingActivityActive(id);
    if (!result.success) alert(result.error);
    setProcessing(null);
    router.refresh();
  };

  // ---------- AI Generator ----------

  const addGenItem = () => {
    setGenItems((prev) => [
      ...prev,
      { categoryId: "", activityType: "reading", difficulty: "basic" },
    ]);
  };

  const updateGenItem = (index: number, field: string, value: string) => {
    setGenItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const removeGenItem = (index: number) => {
    setGenItems((prev) => prev.filter((_, i) => i !== index));
  };

  const runGeneration = async () => {
    if (!genDocId) {
      alert("Please select a source document.");
      return;
    }
    const validItems = genItems.filter((i) => i.categoryId);
    if (validItems.length === 0) {
      alert("Please add at least one activity to generate.");
      return;
    }

    setGenerating(true);
    setGenResults(null);
    try {
      const result = await generateCoachingActivitiesAction({
        documentId: genDocId,
        items: validItems.map((i) => ({
          categoryId: i.categoryId,
          activityType: i.activityType as "reading" | "quiz" | "scenario" | "reflection",
          difficulty: i.difficulty as "basic" | "intermediate" | "advanced",
        })),
        additionalInstructions: genInstructions || undefined,
      });
      setGenResults(result);
      if (result.generated > 0) {
        router.refresh();
      }
    } catch (err) {
      setGenResults({
        generated: 0,
        failed: 0,
        errors: [err instanceof Error ? err.message : "Generation failed"],
      });
    } finally {
      setGenerating(false);
    }
  };

  const openGenerator = () => {
    setGenDocId("");
    setGenItems([{ categoryId: "", activityType: "reading", difficulty: "basic" }]);
    setGenInstructions("");
    setGenResults(null);
    setShowGenerator(true);
  };

  // ---------- Selection ----------

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredActivities.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredActivities.map((a) => a.id)));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Coaching Activities</h1>
          <p className="text-muted-foreground mt-1">
            Manage coaching content assigned to trainees with poor DOR scores.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Manual
          </Button>
          <Button onClick={openGenerator} disabled={!aiConfigured || documents.length === 0}>
            <Sparkles className="h-4 w-4 mr-2" />
            Generate with AI
          </Button>
        </div>
      </div>

      {!aiConfigured && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4">
            <p className="text-sm text-amber-800">
              <AlertCircle className="h-4 w-4 inline mr-1" />
              AI generation is not configured. Set the{" "}
              <code className="bg-amber-100 px-1 rounded">ANTHROPIC_API_KEY</code> environment
              variable to enable it.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Pending Drafts</p>
            <p className="text-2xl font-bold text-amber-600">{stats.drafts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">AI Generated</p>
            <p className="text-2xl font-bold text-blue-600">{stats.aiGenerated}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Input
              placeholder="Search by title..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="w-48"
            />
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="reading">Reading</SelectItem>
                <SelectItem value="reflection">Reflection</SelectItem>
                <SelectItem value="quiz">Quiz</SelectItem>
                <SelectItem value="scenario">Scenario</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            {selectedIds.size > 0 && draftIds.some((id) => selectedIds.has(id)) && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkApprove}
                disabled={processing === "bulk"}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Approve Selected ({[...selectedIds].filter((id) => draftIds.includes(id)).length})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Activities Table */}
      <Card>
        <CardContent className="pt-4">
          {filteredActivities.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No coaching activities found. Create one manually or use AI generation.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox
                      checked={
                        selectedIds.size === filteredActivities.length &&
                        filteredActivities.length > 0
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredActivities.map((a) => {
                  const TypeIcon = TYPE_ICONS[a.type] || BookOpen;
                  const statusInfo = STATUS_BADGES[a.generationStatus] || STATUS_BADGES.manual;
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(a.id)}
                          onCheckedChange={() => toggleSelect(a.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium max-w-[250px]">
                        <span className="truncate block">{a.title}</span>
                        {a.assignmentCount > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {a.assignmentCount} assignment{a.assignmentCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{a.categoryName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <TypeIcon className="h-3.5 w-3.5" />
                          <span className="text-sm capitalize">{a.type}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={DIFFICULTY_COLORS[a.difficulty]}>
                          {a.difficulty}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                          {a.generationStatus !== "manual" && (
                            <span title="AI-Assisted">
                              <Sparkles className="h-3 w-3 text-purple-500" />
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleToggleActive(a.id)}
                          disabled={processing === a.id}
                          className="hover:opacity-70 transition-opacity"
                        >
                          {a.isActive ? (
                            <ToggleRight className="h-5 w-5 text-green-600" />
                          ) : (
                            <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3" />
                          {a.estimatedMins}m
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {a.sourceDocument ? (
                          <div className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            <span className="truncate max-w-[100px]">{a.sourceDocument.title}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Preview"
                            onClick={() => setPreviewActivity(a)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Edit"
                            onClick={() => openEdit(a)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {a.generationStatus === "draft" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Approve"
                                onClick={() => handleApprove(a.id)}
                                disabled={processing === a.id}
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Reject"
                                onClick={() => handleReject(a.id)}
                                disabled={processing === a.id}
                              >
                                <X className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Delete"
                            onClick={() => handleDelete(a.id)}
                            disabled={processing === a.id}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={!!previewActivity} onOpenChange={() => setPreviewActivity(null)}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{previewActivity?.title}</DialogTitle>
            <DialogDescription>
              {previewActivity?.categoryName} &middot;{" "}
              <span className="capitalize">{previewActivity?.type}</span> &middot;{" "}
              <span className="capitalize">{previewActivity?.difficulty}</span> &middot;{" "}
              {previewActivity?.estimatedMins} min
            </DialogDescription>
          </DialogHeader>
          {previewActivity?.description && (
            <p className="text-sm text-muted-foreground">{previewActivity.description}</p>
          )}
          <div className="overflow-y-auto flex-1 bg-muted/50 rounded-lg p-4">
            {previewActivity?.content ? (
              <PreviewContent type={previewActivity.type} content={previewActivity.content} />
            ) : (
              <p className="text-sm text-muted-foreground italic">No content.</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {previewActivity?.generationStatus !== "manual" && (
              <span className="inline-flex items-center gap-1 text-purple-600">
                <Sparkles className="h-3 w-3" />
                Built with the help of AI
              </span>
            )}
            {previewActivity?.sourceDocument && (
              <span>Source: {previewActivity.sourceDocument.title}</span>
            )}
            {previewActivity?.reviewedBy && (
              <span>
                Reviewed by {previewActivity.reviewedBy}
                {previewActivity.reviewedAt &&
                  ` on ${new Date(previewActivity.reviewedAt).toLocaleDateString()}`}
                {previewActivity.reviewNotes && ` — ${previewActivity.reviewNotes}`}
              </span>
            )}
          </div>
          <DialogFooter>
            {previewActivity?.generationStatus === "draft" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    handleApprove(previewActivity.id);
                    setPreviewActivity(null);
                  }}
                >
                  <Check className="h-4 w-4 mr-1" /> Approve
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    handleReject(previewActivity.id);
                    setPreviewActivity(null);
                  }}
                >
                  <X className="h-4 w-4 mr-1" /> Reject
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => setPreviewActivity(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl w-[90vw] max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Activity" : "Create Activity"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update this coaching activity."
                : "Manually create a new coaching activity."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto flex-1 pr-1">
            <div>
              <label className="text-sm font-medium">Title *</label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Activity title"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="One-sentence summary"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Category *</label>
                <Select
                  value={formData.categoryId}
                  onValueChange={(v) => setFormData({ ...formData, categoryId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Type</label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData({ ...formData, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reading">Reading</SelectItem>
                    <SelectItem value="reflection">Reflection</SelectItem>
                    <SelectItem value="quiz">Quiz</SelectItem>
                    <SelectItem value="scenario">Scenario</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Difficulty</label>
                <Select
                  value={formData.difficulty}
                  onValueChange={(v) => setFormData({ ...formData, difficulty: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Estimated Minutes</label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={formData.estimatedMins}
                  onChange={(e) =>
                    setFormData({ ...formData, estimatedMins: parseInt(e.target.value) || 10 })
                  }
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Content</label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={12}
                placeholder="Markdown content for readings/reflections, or JSON for quizzes"
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button onClick={saveForm} disabled={processing === "form"}>
              {editingId ? "Save Changes" : "Create Activity"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Generator Dialog */}
      <Dialog open={showGenerator} onOpenChange={setShowGenerator}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-nmh-teal" />
              AI Coaching Generator
            </DialogTitle>
            <DialogDescription>
              Generate coaching activities from an uploaded resource document using AI. Generated
              activities will be saved as drafts for your review.
              <span className="block mt-1 text-purple-600">
                <Sparkles className="h-3 w-3 inline mr-1" />
                Built with the help of AI (Anthropic Claude)
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 overflow-y-auto flex-1 pr-1">
            {/* Step 1: Source Document */}
            <div>
              <label className="text-sm font-medium">1. Select Source Document *</label>
              <Select value={genDocId} onValueChange={setGenDocId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a document..." />
                </SelectTrigger>
                <SelectContent>
                  {documents.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.title} ({d.fileType.toUpperCase()}, {(d.textLength / 1000).toFixed(1)}k
                      chars)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {documents.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  No resource documents uploaded yet. Upload documents in the Resources page first.
                </p>
              )}
            </div>

            {/* Step 2: Activities to Generate */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">2. Activities to Generate</label>
                <Button variant="outline" size="sm" onClick={addGenItem}>
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
              <div className="space-y-2">
                {genItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Select
                      value={item.categoryId}
                      onValueChange={(v) => updateGenItem(idx, "categoryId", v)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={item.activityType}
                      onValueChange={(v) => updateGenItem(idx, "activityType", v)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reading">Reading</SelectItem>
                        <SelectItem value="reflection">Reflection</SelectItem>
                        <SelectItem value="quiz">Quiz</SelectItem>
                        <SelectItem value="scenario">Scenario</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={item.difficulty}
                      onValueChange={(v) => updateGenItem(idx, "difficulty", v)}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basic">Basic</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeGenItem(idx)}
                      disabled={genItems.length <= 1}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 3: Additional Instructions */}
            <div>
              <label className="text-sm font-medium">3. Additional Instructions (optional)</label>
              <Textarea
                value={genInstructions}
                onChange={(e) => setGenInstructions(e.target.value)}
                rows={3}
                placeholder="e.g., Focus on NMH-specific protocols. Include references to our standard operating procedures."
              />
            </div>

            {/* Results */}
            {genResults && (
              <Card
                className={
                  genResults.generated > 0
                    ? "border-green-200 bg-green-50"
                    : "border-red-200 bg-red-50"
                }
              >
                <CardContent className="pt-4">
                  <p className="font-medium">
                    {genResults.generated > 0 ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 inline mr-1 text-green-600" /> Generated{" "}
                        {genResults.generated} activit{genResults.generated === 1 ? "y" : "ies"} as
                        drafts
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 inline mr-1 text-red-600" /> Generation
                        failed
                      </>
                    )}
                    {genResults.failed > 0 && (
                      <span className="text-red-600 ml-2">({genResults.failed} failed)</span>
                    )}
                  </p>
                  {genResults.errors.length > 0 && (
                    <ul className="text-sm mt-2 space-y-1">
                      {genResults.errors.map((e, i) => (
                        <li key={i} className="text-red-700">
                          {e}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerator(false)}>
              {genResults?.generated ? "Done" : "Cancel"}
            </Button>
            <Button onClick={runGeneration} disabled={generating || !genDocId}>
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" /> Generate (
                  {genItems.filter((i) => i.categoryId).length})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preview Content — renders activity content based on type
// ---------------------------------------------------------------------------

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

function PreviewContent({ type, content }: { type: string; content: string }) {
  // Quiz type: try to parse JSON and render a read-only quiz view
  if (type === "quiz") {
    let questions: QuizQuestion[] | null = null;
    try {
      const parsed = JSON.parse(content);
      const raw: QuizQuestion[] = parsed.questions || parsed;
      if (Array.isArray(raw) && raw.length > 0) {
        questions = raw;
      }
    } catch {
      // Not valid JSON — fall through to markdown
    }

    if (questions) {
      return (
        <div className="space-y-4">
          {questions.map((q, qi) => (
            <div key={qi} className="rounded-lg border bg-background p-4 space-y-2">
              <p className="font-medium text-sm">
                {qi + 1}. {q.question}
              </p>
              <div className="space-y-1.5">
                {q.options.map((opt, oi) => (
                  <div
                    key={oi}
                    className={`px-3 py-2 rounded-md text-sm ${
                      oi === q.correctIndex
                        ? "bg-green-100 border border-green-300 text-green-900 font-medium"
                        : "bg-muted/50 border border-transparent"
                    }`}
                  >
                    {oi === q.correctIndex && <Check className="h-3.5 w-3.5 inline mr-1.5" />}
                    {opt}
                  </div>
                ))}
              </div>
              {q.explanation && (
                <p className="text-xs text-muted-foreground bg-muted p-2 rounded mt-1">
                  {q.explanation}
                </p>
              )}
            </div>
          ))}
        </div>
      );
    }
  }

  // All other types (reading, reflection, scenario) or fallback: render as markdown
  return (
    <div className="prose prose-sm max-w-none text-sm leading-relaxed">
      <Markdown>{content}</Markdown>
    </div>
  );
}
