"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  File,
  Trash2,
  Eye,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  updateResourceDocument,
  deleteResourceDocument,
  toggleResourceActive,
  getResourceDocument,
} from "@/actions/resources";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ResourceDoc {
  id: string;
  title: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  textLength: number;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  uploadedBy: string;
  activityCount: number;
}

interface ResourcesClientProps {
  documents: ResourceDoc[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatChars(chars: number): string {
  if (chars < 1000) return `${chars}`;
  if (chars < 1000000) return `${(chars / 1000).toFixed(1)}k`;
  return `${(chars / 1000000).toFixed(1)}M`;
}

const FILE_TYPE_ICONS: Record<string, typeof FileText> = {
  pdf: File,
  txt: FileText,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ResourcesClient({ documents }: ResourcesClientProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [dragOver, setDragOver] = useState(false);

  // Edit dialog
  const [editDoc, setEditDoc] = useState<ResourceDoc | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Preview dialog
  const [previewDoc, setPreviewDoc] = useState<{
    title: string;
    textContent: string | null;
  } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Delete confirmation
  const [deleteDoc, setDeleteDoc] = useState<ResourceDoc | null>(null);

  // Processing states
  const [processing, setProcessing] = useState<string | null>(null);

  // ---------- Upload ----------

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", uploadTitle || file.name.replace(/\.[^.]+$/, ""));
        formData.append("description", uploadDesc);

        const res = await fetch("/api/resources/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "Upload failed");
          return;
        }

        setUploadTitle("");
        setUploadDesc("");
        router.refresh();
      } catch {
        alert("Upload failed. Please try again.");
      } finally {
        setUploading(false);
      }
    },
    [uploadTitle, uploadDesc, router]
  );

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  // ---------- Preview ----------

  const openPreview = async (doc: ResourceDoc) => {
    setLoadingPreview(true);
    try {
      const full = await getResourceDocument(doc.id);
      if (full) {
        setPreviewDoc({ title: full.title, textContent: full.textContent });
      }
    } catch {
      alert("Failed to load preview.");
    } finally {
      setLoadingPreview(false);
    }
  };

  // ---------- Edit ----------

  const openEdit = (doc: ResourceDoc) => {
    setEditDoc(doc);
    setEditTitle(doc.title);
    setEditDesc(doc.description || "");
  };

  const saveEdit = async () => {
    if (!editDoc) return;
    setProcessing(editDoc.id);
    const result = await updateResourceDocument(editDoc.id, {
      title: editTitle,
      description: editDesc,
    });
    if (!result.success) alert(result.error);
    setEditDoc(null);
    setProcessing(null);
    router.refresh();
  };

  // ---------- Delete ----------

  const confirmDelete = async () => {
    if (!deleteDoc) return;
    setProcessing(deleteDoc.id);
    const result = await deleteResourceDocument(deleteDoc.id);
    if (!result.success) alert(result.error);
    setDeleteDoc(null);
    setProcessing(null);
    router.refresh();
  };

  // ---------- Toggle Active ----------

  const handleToggleActive = async (doc: ResourceDoc) => {
    setProcessing(doc.id);
    const result = await toggleResourceActive(doc.id);
    if (!result.success) alert(result.error);
    setProcessing(null);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Resource Library</h1>
        <p className="text-muted-foreground mt-1">
          Upload organizational documents (protocols, SOPs, guides) to use as source material for
          AI-generated coaching activities.
        </p>
        <p className="text-xs text-purple-600 mt-1 flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          AI coaching generation built with the help of Anthropic Claude
        </p>
      </div>

      {/* Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload Document</CardTitle>
          <CardDescription>Supported formats: PDF, TXT (max 10MB)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              placeholder="Document title (optional — defaults to filename)"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
            />
            <Input
              placeholder="Description (optional)"
              value={uploadDesc}
              onChange={(e) => setUploadDesc(e.target.value)}
            />
          </div>

          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              dragOver
                ? "border-nmh-teal bg-nmh-teal/5"
                : "border-muted-foreground/25 hover:border-nmh-teal/50"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            {uploading ? (
              <p className="text-sm text-muted-foreground">Uploading & extracting text...</p>
            ) : (
              <>
                <p className="text-sm font-medium">Drop a file here, or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">PDF or TXT, up to 10MB</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt"
              className="hidden"
              onChange={onFileSelect}
              disabled={uploading}
            />
          </div>
        </CardContent>
      </Card>

      {/* Documents Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Documents ({documents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No documents uploaded yet. Upload your first document above.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Extracted Text</TableHead>
                  <TableHead>Activities</TableHead>
                  <TableHead>Uploaded By</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => {
                  const Icon = FILE_TYPE_ICONS[doc.fileType] || FileText;
                  return (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="truncate max-w-[200px]">{doc.title}</span>
                        </div>
                        {doc.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">
                            {doc.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="uppercase text-xs">
                          {doc.fileType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{formatBytes(doc.fileSize)}</TableCell>
                      <TableCell className="text-sm">{formatChars(doc.textLength)} chars</TableCell>
                      <TableCell className="text-sm">{doc.activityCount}</TableCell>
                      <TableCell className="text-sm">{doc.uploadedBy}</TableCell>
                      <TableCell className="text-sm">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={doc.isActive ? "default" : "secondary"}>
                          {doc.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Preview extracted text"
                            onClick={() => openPreview(doc)}
                            disabled={loadingPreview}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Edit"
                            onClick={() => openEdit(doc)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={doc.isActive ? "Deactivate" : "Activate"}
                            onClick={() => handleToggleActive(doc)}
                            disabled={processing === doc.id}
                          >
                            {doc.isActive ? (
                              <ToggleRight className="h-4 w-4 text-green-600" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Delete"
                            onClick={() => setDeleteDoc(doc)}
                            disabled={processing === doc.id}
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
      <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{previewDoc?.title}</DialogTitle>
            <DialogDescription>Extracted text content</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[60vh] bg-muted/50 rounded-lg p-4">
            <pre className="text-sm whitespace-pre-wrap font-mono">
              {previewDoc?.textContent || "No text extracted."}
            </pre>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDoc(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editDoc} onOpenChange={() => setEditDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Document</DialogTitle>
            <DialogDescription>
              Update title and description for &quot;{editDoc?.fileName}&quot;
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDoc(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={processing === editDoc?.id}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteDoc} onOpenChange={() => setDeleteDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Resource</DialogTitle>
            <DialogDescription>
              {deleteDoc && deleteDoc.activityCount > 0
                ? `This document has ${deleteDoc.activityCount} linked coaching activities. It will be deactivated instead of deleted.`
                : `Are you sure you want to delete "${deleteDoc?.title}"? This action cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDoc(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={processing === deleteDoc?.id}
            >
              {deleteDoc && deleteDoc.activityCount > 0 ? "Deactivate" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
