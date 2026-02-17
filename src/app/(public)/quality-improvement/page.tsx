import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  GitBranchPlus,
  RefreshCcw,
  ArrowRight,
  BarChart3,
  ListChecks,
} from "lucide-react";
import {
  PDSA_STATUS_LABELS,
  PDSA_STATUS_COLORS,
} from "@/lib/constants";
import { QICampaignsSection } from "@/components/qi/QICampaignsSection";

export const dynamic = "force-dynamic";

export default async function QualityImprovementPage() {
  const [campaigns, standaloneDiagrams, standaloneCycles, cycleStats, actionItemStats] = await Promise.all([
    // Active campaigns with their diagrams
    prisma.campaign.findMany({
      where: { isActive: true, status: { in: ["planning", "active"] } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        owner: { select: { firstName: true, lastName: true } },
        driverDiagrams: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            slug: true,
            _count: { select: { pdsaCycles: true } },
          },
        },
        _count: { select: { actionItems: true } },
      },
    }),
    // Diagrams not in any campaign
    prisma.driverDiagram.findMany({
      where: { isActive: true, status: "active", campaignId: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        metricDefinition: { select: { name: true } },
        _count: { select: { nodes: true, pdsaCycles: true } },
      },
    }),
    // PDSA cycles not in any campaign's diagrams (standalone)
    prisma.pdsaCycle.findMany({
      where: {
        status: { notIn: ["completed", "abandoned"] },
        OR: [
          { driverDiagramId: null },
          { driverDiagram: { campaignId: null } },
        ],
      },
      take: 6,
      orderBy: { updatedAt: "desc" },
      include: {
        driverDiagram: { select: { name: true } },
      },
    }),
    // Overall cycle stats
    prisma.pdsaCycle.groupBy({
      by: ["status"],
      _count: true,
    }),
    // Action item stats
    prisma.actionItem.groupBy({
      by: ["status"],
      _count: true,
    }),
  ]);

  // Serialize campaign data for client component
  const campaignData = campaigns.map((c) => {
    const totalCycles = c.driverDiagrams.reduce((sum, d) => sum + d._count.pdsaCycles, 0);
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      status: c.status,
      ownerName: c.owner ? `${c.owner.firstName} ${c.owner.lastName}` : null,
      startDate: c.startDate?.toISOString().split("T")[0] ?? null,
      endDate: c.endDate?.toISOString().split("T")[0] ?? null,
      diagrams: c.driverDiagrams.map((d) => ({
        id: d.id,
        name: d.name,
        slug: d.slug,
        cycleCount: d._count.pdsaCycles,
      })),
      totalCycles,
      actionItemCount: c._count.actionItems,
    };
  });

  const totalActiveCycles = cycleStats
    .filter((s) => !["completed", "abandoned"].includes(s.status))
    .reduce((sum, s) => sum + s._count, 0);
  const totalCompletedCycles = cycleStats.find((s) => s.status === "completed")?._count ?? 0;
  const openActionItems = actionItemStats
    .filter((s) => s.status !== "completed")
    .reduce((sum, s) => sum + s._count, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-nmh-gray">
          Quality Improvement
        </h1>
        <p className="text-muted-foreground mt-1">
          Campaigns, driver diagrams, and PDSA cycles supporting continuous improvement across NMH EMS operations.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-nmh-teal">
              {campaigns.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Active Campaigns</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-nmh-orange">
              {totalActiveCycles}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Active PDSA Cycles</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-nmh-gray">
              {totalCompletedCycles}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Completed Cycles</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-nmh-teal">
              {openActionItems}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Open Action Items</p>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns — Primary Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-5 w-5 text-nmh-teal" />
          <h2 className="text-lg font-semibold text-nmh-gray">
            QI Campaigns
          </h2>
        </div>

        <QICampaignsSection campaigns={campaignData} />
      </section>

      {/* Standalone Activities */}
      {(standaloneDiagrams.length > 0 || standaloneCycles.length > 0) && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <GitBranchPlus className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-nmh-gray">
              Other QI Activities
            </h2>
          </div>

          {/* Standalone Diagrams */}
          {standaloneDiagrams.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Driver Diagrams</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {standaloneDiagrams.map((d) => (
                  <Link key={d.id} href={`/quality-improvement/diagram/${d.slug}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center justify-between">
                          <span className="truncate">{d.name}</span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {d.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{d.description}</p>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                          {d.metricDefinition && (
                            <Badge variant="outline" className="text-xs bg-nmh-teal/5 text-nmh-teal border-nmh-teal/20">
                              <BarChart3 className="h-3 w-3 mr-1" />
                              {d.metricDefinition.name}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">{d._count.nodes} nodes</Badge>
                          {d._count.pdsaCycles > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              <RefreshCcw className="h-3 w-3 mr-1" />
                              {d._count.pdsaCycles} cycles
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Standalone PDSA Cycles */}
          {standaloneCycles.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-muted-foreground">Active PDSA Cycles</h3>
                <Link href="/quality-improvement/pdsa" className="text-sm text-nmh-teal hover:underline flex items-center gap-1">
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {standaloneCycles.map((c) => {
                  const sColor = PDSA_STATUS_COLORS[c.status] ?? "#4b4f54";
                  return (
                    <Card key={c.id}>
                      <CardContent className="pt-6 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm truncate">{c.title}</span>
                          <Badge variant="secondary" style={{ backgroundColor: `${sColor}20`, color: sColor }}>
                            {PDSA_STATUS_LABELS[c.status] ?? c.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Cycle #{c.cycleNumber}</span>
                          {c.driverDiagram && (
                            <>
                              <span>&middot;</span>
                              <span className="truncate">{c.driverDiagram.name}</span>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
