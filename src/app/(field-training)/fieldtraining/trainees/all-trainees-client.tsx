"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, Search } from "lucide-react";

interface TraineeRow {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  status: string;
  startDate: string;
  currentFto: string | null;
  currentPhase: string | null;
  completedPhases: number;
  totalPhases: number;
  dorCount: number;
}

interface AllTraineesClientProps {
  trainees: TraineeRow[];
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
  separated: "bg-gray-100 text-gray-700",
  remediation: "bg-orange-100 text-orange-700",
};

export function AllTraineesClient({ trainees }: AllTraineesClientProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");

  const filtered = trainees.filter((t) => {
    const matchesSearch =
      !search ||
      `${t.firstName} ${t.lastName}`
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      t.employeeId.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeCount = trainees.filter((t) => t.status === "active").length;
  const remCount = trainees.filter((t) => t.status === "remediation").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">All Trainees</h1>
        <p className="text-muted-foreground mt-1">
          Overview of all trainees across the program
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{trainees.length}</div>
            <div className="text-xs text-muted-foreground">Total Trainees</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-green-600">
              {activeCount}
            </div>
            <div className="text-xs text-muted-foreground">Active</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-orange-600">
              {remCount}
            </div>
            <div className="text-xs text-muted-foreground">Remediation</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-blue-600">
              {trainees.filter((t) => t.status === "completed").length}
            </div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </CardContent>
        </Card>
      </div>

      {/* Trainee Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              Trainees
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search name or ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-56"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="remediation">Remediation</option>
                <option value="completed">Completed</option>
                <option value="separated">Separated</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No trainees found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Current FTO</TableHead>
                    <TableHead>Current Phase</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead className="text-center">DORs</TableHead>
                    <TableHead>Start Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((t) => {
                    const progressPct =
                      t.totalPhases > 0
                        ? Math.round(
                            (t.completedPhases / t.totalPhases) * 100
                          )
                        : 0;
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">
                          {t.lastName}, {t.firstName}
                        </TableCell>
                        <TableCell>{t.employeeId}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              STATUS_COLORS[t.status] ||
                              "bg-gray-100 text-gray-700"
                            }
                          >
                            {t.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{t.currentFto || "-"}</TableCell>
                        <TableCell>{t.currentPhase || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <Progress
                              value={progressPct}
                              className="h-2 flex-1"
                            />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {t.completedPhases}/{t.totalPhases}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {t.dorCount}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {new Date(t.startDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
