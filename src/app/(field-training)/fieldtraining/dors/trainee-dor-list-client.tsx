"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Dor = {
  id: string;
  date: string;
  ftoName: string;
  phaseName: string | null;
  overallRating: number;
  traineeAcknowledged: boolean;
  acknowledgedAt: string | null;
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

export function TraineeDorListClient({ dors }: Props) {
  const [filter, setFilter] = useState<"all" | "pending" | "acknowledged">("all");

  const filtered = dors.filter((d) => {
    if (filter === "pending") return !d.traineeAcknowledged;
    if (filter === "acknowledged") return d.traineeAcknowledged;
    return true;
  });

  const pendingCount = dors.filter((d) => !d.traineeAcknowledged).length;
  const acknowledgedCount = dors.filter((d) => d.traineeAcknowledged).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My DORs</h1>
        <p className="text-muted-foreground">Daily Observation Reports</p>
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
          variant={filter === "pending" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("pending")}
        >
          Pending ({pendingCount})
        </Button>
        <Button
          variant={filter === "acknowledged" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("acknowledged")}
        >
          Acknowledged ({acknowledgedCount})
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {filter === "all"
              ? "All DORs"
              : filter === "pending"
                ? "Pending Acknowledgment"
                : "Acknowledged DORs"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {filter === "pending"
                ? "No DORs pending acknowledgment."
                : filter === "acknowledged"
                  ? "No acknowledged DORs."
                  : "No DORs yet."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>FTO</TableHead>
                  <TableHead>Phase</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((dor) => (
                  <TableRow key={dor.id}>
                    <TableCell className="font-medium">
                      {new Date(dor.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{dor.ftoName}</TableCell>
                    <TableCell>{dor.phaseName || "—"}</TableCell>
                    <TableCell>
                      <Badge className={RATING_COLORS[dor.overallRating]}>
                        {dor.overallRating}/7
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {dor.traineeAcknowledged ? (
                        <Badge className="bg-green-600">Acknowledged</Badge>
                      ) : (
                        <Badge variant="outline" className="border-orange-400 text-orange-700">
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/fieldtraining/dors/${dor.id}`}>
                          {dor.traineeAcknowledged ? "View" : "Review"}
                        </Link>
                      </Button>
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
