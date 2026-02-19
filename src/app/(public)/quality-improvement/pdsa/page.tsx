import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCcw } from "lucide-react";

export const dynamic = "force-dynamic";

const statusColors: Record<string, string> = {
  planning: "bg-[#00b0ad]/10 text-[#00b0ad]",
  doing: "bg-[#e04726]/10 text-[#e04726]",
  studying: "bg-[#fcb526]/10 text-[#fcb526]",
  acting: "bg-[#4b4f54]/10 text-[#4b4f54]",
  completed: "bg-[#00383d]/10 text-[#00383d]",
  abandoned: "bg-[#60151E]/10 text-[#60151E]",
};

const statusLabels: Record<string, string> = {
  planning: "Plan",
  doing: "Do",
  studying: "Study",
  acting: "Act",
  completed: "Completed",
  abandoned: "Abandoned",
};

const outcomeColors: Record<string, string> = {
  adopt: "bg-green-100 text-green-700",
  adapt: "bg-yellow-100 text-yellow-700",
  abandon: "bg-red-100 text-red-700",
};

export default async function PublicPdsaPage() {
  const cycles = await prisma.pdsaCycle.findMany({
    orderBy: [{ updatedAt: "desc" }],
    include: {
      driverDiagram: { select: { name: true, slug: true } },
      metricDefinition: { select: { name: true } },
      changeIdeaNode: { select: { text: true } },
    },
  });

  const activeCycles = cycles.filter((c) => !["completed", "abandoned"].includes(c.status));
  const completedCycles = cycles.filter(
    (c) => c.status === "completed" || c.status === "abandoned"
  );

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <Link
          href="/quality-improvement"
          className="inline-flex items-center gap-1.5 text-sm text-nmh-teal hover:underline mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Quality Improvement
        </Link>
        <h1 className="text-2xl font-bold text-nmh-gray flex items-center gap-2">
          <RefreshCcw className="h-6 w-6 text-nmh-orange" />
          PDSA Cycles
        </h1>
        <p className="text-muted-foreground mt-1">
          Plan-Do-Study-Act improvement cycles across EMS operations.
        </p>
      </div>

      {/* Active Cycles */}
      <section>
        <h2 className="text-lg font-semibold text-nmh-gray mb-4">
          Active Cycles
          {activeCycles.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeCycles.length}
            </Badge>
          )}
        </h2>

        {activeCycles.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              No active PDSA cycles.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {activeCycles.map((c) => (
              <Card key={c.id}>
                <CardContent className="py-4 px-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{c.title}</span>
                        <Badge variant="secondary" className="text-xs">
                          Cycle #{c.cycleNumber}
                        </Badge>
                        <Badge variant="secondary" className={statusColors[c.status] ?? ""}>
                          {statusLabels[c.status] ?? c.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        {c.driverDiagram && (
                          <Link
                            href={`/quality-improvement/diagram/${c.driverDiagram.slug}`}
                            className="hover:text-nmh-teal hover:underline"
                          >
                            {c.driverDiagram.name}
                          </Link>
                        )}
                        {c.changeIdeaNode && (
                          <span className="truncate max-w-xs">
                            Change Idea: {c.changeIdeaNode.text}
                          </span>
                        )}
                        {c.metricDefinition && <span>Metric: {c.metricDefinition.name}</span>}
                      </div>

                      {/* Phase summaries */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
                        {c.planDescription && (
                          <div className="text-xs">
                            <span className="font-medium text-[#00b0ad]">Plan:</span>{" "}
                            <span className="text-muted-foreground line-clamp-2">
                              {c.planDescription}
                            </span>
                          </div>
                        )}
                        {c.doObservations && (
                          <div className="text-xs">
                            <span className="font-medium text-[#e04726]">Do:</span>{" "}
                            <span className="text-muted-foreground line-clamp-2">
                              {c.doObservations}
                            </span>
                          </div>
                        )}
                        {c.studyResults && (
                          <div className="text-xs">
                            <span className="font-medium text-[#fcb526]">Study:</span>{" "}
                            <span className="text-muted-foreground line-clamp-2">
                              {c.studyResults}
                            </span>
                          </div>
                        )}
                        {c.actDecision && (
                          <div className="text-xs">
                            <span className="font-medium text-[#4b4f54]">Act:</span>{" "}
                            <span className="text-muted-foreground line-clamp-2">
                              {c.actDecision}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Completed Cycles */}
      {completedCycles.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-nmh-gray mb-4">
            Completed & Archived
            <Badge variant="secondary" className="ml-2">
              {completedCycles.length}
            </Badge>
          </h2>

          <div className="space-y-3">
            {completedCycles.map((c) => (
              <Card key={c.id} className="opacity-80">
                <CardContent className="py-4 px-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{c.title}</span>
                        <Badge variant="secondary" className="text-xs">
                          Cycle #{c.cycleNumber}
                        </Badge>
                        <Badge variant="secondary" className={statusColors[c.status] ?? ""}>
                          {statusLabels[c.status] ?? c.status}
                        </Badge>
                        {c.outcome && (
                          <Badge variant="secondary" className={outcomeColors[c.outcome] ?? ""}>
                            {c.outcome.charAt(0).toUpperCase() + c.outcome.slice(1)}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        {c.driverDiagram && <span>{c.driverDiagram.name}</span>}
                        {c.metricDefinition && <span>Metric: {c.metricDefinition.name}</span>}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(c.updatedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
