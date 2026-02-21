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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Eye, ArrowLeft } from "lucide-react";
import { createTrainee } from "@/actions/field-training";

type TraineeRow = {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  email: string | null;
  hireDate: string;
  startDate: string;
  completionDate: string | null;
  status: string;
  divisionName: string | null;
  divisionId: string | null;
  currentFtos: string[];
  currentPhase: string | null;
  phasesCompleted: number;
  totalPhases: number;
  evalCount: number;
  skillsCompleted: number;
  totalSkills: number;
};

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  completed: "bg-blue-100 text-blue-800",
  separated: "bg-gray-100 text-gray-800",
  remediation: "bg-orange-100 text-orange-800",
};

export function TraineesClient({
  trainees,
  divisions,
}: {
  trainees: TraineeRow[];
  divisions: { id: string; name: string }[];
  ftos: { id: string; firstName: string; lastName: string }[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const filtered = filter === "all" ? trainees : trainees.filter((t) => t.status === filter);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await createTrainee(formData);
    if (!result.success) {
      setError(result.error || "Failed to create trainee.");
      return;
    }
    setDialogOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild aria-label="Go back">
            <Link href="/admin/field-training">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Trainees</h1>
            <p className="text-muted-foreground">
              Manage trainees and track their progress through the FTO program.
            </p>
          </div>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setError(null);
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Trainee
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <form action={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Add Trainee</DialogTitle>
                <DialogDescription>Enter the new trainee&apos;s information.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" name="firstName" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" name="lastName" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="employeeId">Employee ID</Label>
                    <Input id="employeeId" name="employeeId" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hireDate">Hire Date</Label>
                    <Input id="hireDate" name="hireDate" type="date" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Training Start Date</Label>
                    <Input id="startDate" name="startDate" type="date" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="divisionId">Division</Label>
                  <Select name="divisionId">
                    <SelectTrigger>
                      <SelectValue placeholder="Select division..." />
                    </SelectTrigger>
                    <SelectContent>
                      {divisions.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" name="notes" />
                </div>
                <input type="hidden" name="status" value="active" />
              </div>
              <DialogFooter>
                <Button type="submit">Create Trainee</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {["all", "active", "completed", "remediation", "separated"].map((s) => (
          <Button
            key={s}
            variant={filter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(s)}
          >
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== "all" && (
              <Badge variant="secondary" className="ml-1.5">
                {trainees.filter((t) => t.status === s).length}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trainee Roster</CardTitle>
          <CardDescription>
            {filtered.length} trainee{filtered.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Employee ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Current Phase</TableHead>
                <TableHead>Assigned FTO</TableHead>
                <TableHead>Skills Progress</TableHead>
                <TableHead>DORs</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => {
                const skillPct =
                  t.totalSkills > 0 ? Math.round((t.skillsCompleted / t.totalSkills) * 100) : 0;
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Link
                        href={`/admin/field-training/trainees/${t.id}`}
                        className="font-medium text-nmh-teal hover:underline"
                      >
                        {t.lastName}, {t.firstName}
                      </Link>
                      {t.divisionName && (
                        <p className="text-xs text-muted-foreground">{t.divisionName}</p>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{t.employeeId}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[t.status] ?? ""}>{t.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="text-sm">{t.currentPhase ?? "—"}</span>
                        <p className="text-xs text-muted-foreground">
                          {t.phasesCompleted}/{t.totalPhases} phases
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {t.currentFtos.length > 0 ? (
                        t.currentFtos.join(", ")
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <Progress value={skillPct} className="h-2 flex-1" />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {t.skillsCompleted}/{t.totalSkills}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{t.evalCount}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/admin/field-training/trainees/${t.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No trainees found.
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
