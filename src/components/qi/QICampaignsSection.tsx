"use client";

import Link from "next/link";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LayoutGrid,
  LayoutList,
  GanttChartSquare,
  ArrowRight,
  GitBranchPlus,
  RefreshCcw,
  ListChecks,
  Calendar,
  User,
} from "lucide-react";
import { CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUS_COLORS } from "@/lib/constants";
import { CampaignGanttChart } from "@/components/qi/CampaignGanttChart";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DiagramSummary {
  id: string;
  name: string;
  slug: string;
  cycleCount: number;
}

export interface CampaignSectionItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  ownerName: string | null;
  startDate: string | null;
  endDate: string | null;
  diagrams: DiagramSummary[];
  totalCycles: number;
  actionItemCount: number;
}

interface Props {
  campaigns: CampaignSectionItem[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const color = CAMPAIGN_STATUS_COLORS[status] ?? "#4b4f54";
  return (
    <Badge variant="secondary" style={{ backgroundColor: `${color}20`, color }}>
      {CAMPAIGN_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QICampaignsSection({ campaigns }: Props) {
  if (campaigns.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          No active campaigns yet.
        </CardContent>
      </Card>
    );
  }

  const ganttItems = campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    linkId: c.slug,
    status: c.status,
    ownerName: c.ownerName,
    startDate: c.startDate,
    endDate: c.endDate,
  }));

  return (
    <Tabs defaultValue="cards">
      <TabsList>
        <TabsTrigger value="cards" className="gap-1.5">
          <LayoutGrid className="h-4 w-4" /> Cards
        </TabsTrigger>
        <TabsTrigger value="list" className="gap-1.5">
          <LayoutList className="h-4 w-4" /> List
        </TabsTrigger>
        <TabsTrigger value="gantt" className="gap-1.5">
          <GanttChartSquare className="h-4 w-4" /> Gantt
        </TabsTrigger>
      </TabsList>

      {/* Cards View */}
      <TabsContent value="cards" className="mt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map((c) => {
            const statusColor = CAMPAIGN_STATUS_COLORS[c.status] ?? "#4b4f54";
            return (
              <Link key={c.id} href={`/quality-improvement/campaign/${c.slug}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base truncate">{c.name}</CardTitle>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant="secondary"
                          style={{
                            backgroundColor: `${statusColor}20`,
                            color: statusColor,
                          }}
                        >
                          {CAMPAIGN_STATUS_LABELS[c.status] ?? c.status}
                        </Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {c.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{c.description}</p>
                    )}

                    {/* Progress bar */}
                    {c.totalCycles > 0 && (
                      <div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span>PDSA Progress</span>
                          <span>{c.totalCycles} cycles</span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                      {c.ownerName && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {c.ownerName}
                        </span>
                      )}
                      {(c.startDate || c.endDate) && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {c.startDate ?? "—"} → {c.endDate ?? "—"}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs">
                        <GitBranchPlus className="h-3 w-3 mr-1" />
                        {c.diagrams.length} diagrams
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        <RefreshCcw className="h-3 w-3 mr-1" />
                        {c.totalCycles} cycles
                      </Badge>
                      {c.actionItemCount > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          <ListChecks className="h-3 w-3 mr-1" />
                          {c.actionItemCount} actions
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </TabsContent>

      {/* List View */}
      <TabsContent value="list" className="mt-4">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead className="text-center">Diagrams</TableHead>
                  <TableHead className="text-center">Cycles</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link
                        href={`/quality-improvement/campaign/${c.slug}`}
                        className="font-medium hover:text-nmh-teal flex items-center gap-1"
                      >
                        {c.name}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.ownerName ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.startDate ?? "—"} → {c.endDate ?? "—"}
                    </TableCell>
                    <TableCell className="text-center">{c.diagrams.length}</TableCell>
                    <TableCell className="text-center">{c.totalCycles}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Gantt View */}
      <TabsContent value="gantt" className="mt-4">
        <CampaignGanttChart campaigns={ganttItems} linkPrefix="/quality-improvement/campaign" />
      </TabsContent>
    </Tabs>
  );
}
