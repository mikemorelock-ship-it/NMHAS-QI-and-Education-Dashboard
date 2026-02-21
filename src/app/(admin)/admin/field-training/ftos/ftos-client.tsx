"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, UserCheck, ArrowLeft, KeyRound } from "lucide-react";
import {
  createFto,
  updateFto,
  deleteFto,
  toggleFtoActive,
  setFtoPin,
} from "@/actions/field-training";
import { FTO_ROLE_LABELS } from "@/lib/constants";

type Fto = {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  email: string | null;
  badgeNumber: string | null;
  divisionId: string | null;
  divisionName: string | null;
  role: string;
  hasPin: boolean;
  isActive: boolean;
  assignmentCount: number;
  evalCount: number;
};

type Division = {
  id: string;
  name: string;
};

export function FtosClient({ ftos, divisions }: { ftos: Fto[]; divisions: Division[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFto, setEditingFto] = useState<Fto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinFto, setPinFto] = useState<Fto | null>(null);
  const [pinValue, setPinValue] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = editingFto
      ? await updateFto(editingFto.id, formData)
      : await createFto(formData);
    if (!result.success) {
      setError(result.error || "Failed to save FTO.");
      return;
    }
    setDialogOpen(false);
    setEditingFto(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this FTO?")) return;
    const result = await deleteFto(id);
    if (!result.success) alert(result.error);
  }

  async function handleToggleActive(fto: Fto) {
    const result = await toggleFtoActive(fto.id, !fto.isActive);
    if (!result.success) alert(result.error);
  }

  async function handleSetPin() {
    setPinError(null);
    if (!pinFto) return;
    if (pinValue.length < 6 || pinValue.length > 8) {
      setPinError("PIN must be 6-8 digits.");
      return;
    }
    if (pinValue !== pinConfirm) {
      setPinError("PINs do not match.");
      return;
    }
    const result = await setFtoPin(pinFto.id, pinValue);
    if (!result.success) {
      setPinError(result.error || "Failed to set PIN.");
      return;
    }
    setPinDialogOpen(false);
    setPinFto(null);
    setPinValue("");
    setPinConfirm("");
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
          <h1 className="text-2xl font-bold tracking-tight">Field Training Officers</h1>
          <p className="text-muted-foreground">Manage FTOs who supervise and evaluate trainees.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>FTOs</CardTitle>
            <CardDescription>
              {ftos.length} field training officer{ftos.length !== 1 && "s"} total
            </CardDescription>
          </div>
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setEditingFto(null);
                setError(null);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add FTO
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form action={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>{editingFto ? "Edit FTO" : "Add FTO"}</DialogTitle>
                  <DialogDescription>
                    {editingFto
                      ? "Update the field training officer details."
                      : "Add a new field training officer."}
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        name="firstName"
                        defaultValue={editingFto?.firstName}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        name="lastName"
                        defaultValue={editingFto?.lastName}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="employeeId">Employee ID</Label>
                      <Input
                        id="employeeId"
                        name="employeeId"
                        defaultValue={editingFto?.employeeId}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="badgeNumber">Badge Number</Label>
                      <Input
                        id="badgeNumber"
                        name="badgeNumber"
                        defaultValue={editingFto?.badgeNumber ?? ""}
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      defaultValue={editingFto?.email ?? ""}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="divisionId">Division</Label>
                      <Select name="divisionId" defaultValue={editingFto?.divisionId ?? ""}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select division (optional)" />
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
                      <Label htmlFor="role">Role</Label>
                      <Select name="role" defaultValue={editingFto?.role ?? "fto"}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(FTO_ROLE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">{editingFto ? "Update" : "Create"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Employee ID</TableHead>
                <TableHead>Badge #</TableHead>
                <TableHead>Division</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>PIN</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assignments</TableHead>
                <TableHead>Evaluations</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ftos.map((fto) => (
                <TableRow key={fto.id}>
                  <TableCell className="font-medium">
                    {fto.firstName} {fto.lastName}
                  </TableCell>
                  <TableCell>{fto.employeeId}</TableCell>
                  <TableCell>{fto.badgeNumber ?? "—"}</TableCell>
                  <TableCell>{fto.divisionName ?? "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        fto.role === "supervisor"
                          ? "border-blue-300 text-blue-700 bg-blue-50"
                          : fto.role === "manager"
                            ? "border-purple-300 text-purple-700 bg-purple-50"
                            : fto.role === "admin"
                              ? "border-red-300 text-red-700 bg-red-50"
                              : ""
                      }
                    >
                      {FTO_ROLE_LABELS[fto.role] ?? fto.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={fto.hasPin ? "default" : "outline"}
                      className={fto.hasPin ? "bg-green-600" : "text-muted-foreground"}
                    >
                      {fto.hasPin ? "Set" : "None"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={fto.isActive ? "default" : "secondary"}>
                      {fto.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{fto.assignmentCount}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{fto.evalCount}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Set PIN"
                        onClick={() => {
                          setPinFto(fto);
                          setPinValue("");
                          setPinConfirm("");
                          setPinError(null);
                          setPinDialogOpen(true);
                        }}
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={fto.isActive ? "Deactivate" : "Activate"}
                        onClick={() => handleToggleActive(fto)}
                      >
                        <UserCheck
                          className={`h-4 w-4 ${
                            fto.isActive ? "text-green-600" : "text-muted-foreground"
                          }`}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingFto(fto);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {fto.assignmentCount === 0 && fto.evalCount === 0 && (
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(fto.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {ftos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    No field training officers added yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* PIN Dialog */}
      <Dialog
        open={pinDialogOpen}
        onOpenChange={(open) => {
          setPinDialogOpen(open);
          if (!open) {
            setPinFto(null);
            setPinError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Portal PIN</DialogTitle>
            <DialogDescription>
              {pinFto
                ? `Set a 6-8 digit PIN for ${pinFto.firstName} ${pinFto.lastName} to access the Field Training Portal.`
                : "Set a PIN for Field Training Portal access."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {pinError && <p className="text-sm text-destructive">{pinError}</p>}
            <div className="space-y-2">
              <Label htmlFor="pin">PIN (6-8 digits)</Label>
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pinValue}
                onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter PIN"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pinConfirm">Confirm PIN</Label>
              <Input
                id="pinConfirm"
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
                placeholder="Confirm PIN"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPinDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSetPin}>Set PIN</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
