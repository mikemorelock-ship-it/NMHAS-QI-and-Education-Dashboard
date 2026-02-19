"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Eye } from "lucide-react";

type Dor = {
  id: string;
  date: string;
  traineeName: string;
  traineeEmployeeId: string;
  phaseName: string | null;
  overallRating: number;
  status: string;
  traineeAcknowledged: boolean;
  recommendAction: string;
};

type Props = { dors: Dor[] };

const RATING_COLORS: Record<number, string> = {
  1: "bg-red-700 text-white",
  2: "bg-red-500 text-white",
  3: "bg-orange-500 text-white",
  4: "bg-gray-500 text-white",
  5: "bg-green-500 text-white",
  6: "bg-green-600 text-white",
  7: "bg-emerald-700 text-white",
};

export function FtoDorListClient({ dors }: Props) {
  const [filter, setFilter] = useState<"all" | "draft" | "submitted">("all");

  const filtered = dors.filter((d) => {
    if (filter === "draft") return d.status === "draft";
    if (filter === "submitted") return d.status === "submitted";
    return true;
  });

  const draftCount = dors.filter((d) => d.status === "draft").length;
  const submittedCount = dors.filter((d) => d.status === "submitted").length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My DORs</h1>
          <p className="text-muted-foreground">Daily Observation Reports</p>
        </div>
        <Button asChild>
          <Link href="/fieldtraining/dors/new">
            <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
            New DOR
          </Link>
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          All ({dors.length})
        </Button>
        <Button
          variant={filter === "draft" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("draft")}
        >
          Drafts ({draftCount})
        </Button>
        <Button
          variant={filter === "submitted" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("submitted")}
        >
          Submitted ({submittedCount})
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {filter === "all" ? "All DORs" : filter === "draft" ? "Draft DORs" : "Submitted DORs"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {filter === "draft"
                ? "No draft DORs."
                : filter === "submitted"
                  ? "No submitted DORs."
                  : "No DORs yet. Create your first one!"}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Trainee</TableHead>
                  <TableHead>Phase</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Acknowledged</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((dor) => (
                  <TableRow key={dor.id}>
                    <TableCell className="font-medium">
                      {new Date(dor.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div>
                        <span>{dor.traineeName}</span>
                        <span className="text-xs text-muted-foreground ml-1">
                          ({dor.traineeEmployeeId})
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{dor.phaseName || "—"}</TableCell>
                    <TableCell>
                      <Badge className={RATING_COLORS[dor.overallRating]}>
                        {dor.overallRating}/7
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={dor.status === "draft" ? "outline" : "default"}>
                        {dor.status === "draft" ? "Draft" : "Submitted"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {dor.status === "submitted" && (
                        <Badge
                          variant={dor.traineeAcknowledged ? "default" : "secondary"}
                          className={dor.traineeAcknowledged ? "bg-green-600" : ""}
                        >
                          {dor.traineeAcknowledged ? "Yes" : "Pending"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {dor.status === "draft" ? (
                        <Button variant="ghost" size="icon" asChild aria-label={`Edit DOR for ${dor.traineeName} on ${new Date(dor.date).toLocaleDateString()}`}>
                          <Link href={`/fieldtraining/dors/${dor.id}/edit`}>
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </Link>
                        </Button>
                      ) : (
                        <Button variant="ghost" size="icon" asChild aria-label={`View DOR for ${dor.traineeName} on ${new Date(dor.date).toLocaleDateString()}`}>
                          <Link href={`/fieldtraining/dors/${dor.id}`}>
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </Link>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
