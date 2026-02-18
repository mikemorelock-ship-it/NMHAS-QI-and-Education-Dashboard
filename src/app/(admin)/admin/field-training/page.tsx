import { verifySession } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  UserCheck,
  ClipboardCheck,
  BookOpen,
  ArrowRight,
  AlertTriangle,
  Plus,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function RatingBadge({ rating }: { rating: number }) {
  const color =
    rating === 1 ? "bg-red-200 text-red-900" :
    rating === 2 ? "bg-red-100 text-red-800" :
    rating === 3 ? "bg-orange-100 text-orange-800" :
    rating === 4 ? "bg-gray-100 text-gray-800" :
    rating === 5 ? "bg-green-100 text-green-800" :
    rating === 6 ? "bg-green-200 text-green-900" :
    "bg-emerald-200 text-emerald-900";
  return <Badge className={cn("font-mono text-xs", color)}>{rating}/7</Badge>;
}

export default async function FieldTrainingOverviewPage() {
  const session = await verifySession();
  if (!session || !hasAdminPermission(session.role, "manage_ftos_trainees")) {
    notFound();
  }

  const [
    activeTrainees,
    completedTrainees,
    totalFtos,
    totalDors,
    totalSkills,
    recentDors,
    traineeSummaries,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "trainee", traineeStatus: "active" } }),
    prisma.user.count({ where: { role: "trainee", traineeStatus: "completed" } }),
    prisma.user.count({ where: { role: { in: ["fto", "supervisor", "manager"] }, isActive: true } }),
    prisma.dailyEvaluation.count(),
    prisma.skill.count({ where: { isActive: true } }),
    prisma.dailyEvaluation.findMany({
      orderBy: { date: "desc" },
      take: 5,
      include: {
        trainee: { select: { id: true, firstName: true, lastName: true } },
        fto: { select: { firstName: true, lastName: true } },
        phase: { select: { name: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: "trainee", traineeStatus: { in: ["active", "remediation"] } },
      orderBy: { lastName: "asc" },
      include: {
        traineePhases: {
          include: { phase: { select: { name: true } } },
          orderBy: { phase: { sortOrder: "asc" } },
        },
        _count: { select: { traineeSkillSignoffs: true } },
        traineeAssignments: {
          where: { status: "active" },
          include: { fto: { select: { firstName: true, lastName: true } } },
        },
      },
    }),
  ]);

  const remediationCount = traineeSummaries.filter((t) => t.traineeStatus === "remediation").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Field Training Program</h1>
        <p className="text-muted-foreground">Overview of the FTEP field training program.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <Users className="h-5 w-5 text-green-700" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeTrainees}</p>
                <p className="text-sm text-muted-foreground">Active Trainees</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <UserCheck className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalFtos}</p>
                <p className="text-sm text-muted-foreground">Active FTOs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <ClipboardCheck className="h-5 w-5 text-purple-700" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalDors}</p>
                <p className="text-sm text-muted-foreground">DORs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-nmh-teal/10">
                <BookOpen className="h-5 w-5 text-nmh-teal" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedTrainees}</p>
                <p className="text-sm text-muted-foreground">Graduated</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* DOR Quick Access */}
      <Card className="border-purple-200 bg-purple-50/50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-purple-100">
                <ClipboardCheck className="h-6 w-6 text-purple-700" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-purple-900">Daily Observation Reports</h3>
                <p className="text-sm text-purple-700">{totalDors} total DOR{totalDors !== 1 ? "s" : ""} on record</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" className="border-purple-300 text-purple-700 hover:bg-purple-100">
                <Link href="/admin/field-training/dors">
                  <FileText className="h-4 w-4 mr-1.5" />
                  View All DORs
                </Link>
              </Button>
              <Button asChild className="bg-purple-700 hover:bg-purple-800 text-white">
                <Link href="/admin/field-training/dors/new">
                  <Plus className="h-4 w-4 mr-1.5" />
                  New DOR
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {remediationCount > 0 && (
        <Card className="border-orange-300 bg-orange-50">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-orange-800">
              {remediationCount} trainee{remediationCount > 1 ? "s" : ""} currently in remediation status.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Active Trainees Progress */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Active Trainees</CardTitle>
              <CardDescription>Current progress for all active trainees</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/field-training/trainees">View All <ArrowRight className="h-4 w-4 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {traineeSummaries.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No active trainees.</p>
            ) : (
              <div className="space-y-4">
                {traineeSummaries.map((t) => {
                  const currentPhase = t.traineePhases.find((tp) => tp.status === "in_progress")?.phase.name;
                  const phasesCompleted = t.traineePhases.filter((tp) => tp.status === "completed").length;
                  const skillPct = totalSkills > 0 ? Math.round((t._count.traineeSkillSignoffs / totalSkills) * 100) : 0;
                  const ftoNames = t.traineeAssignments
                    .map((a) => `${a.fto.firstName} ${a.fto.lastName}`);

                  return (
                    <Link
                      key={t.id}
                      href={`/admin/field-training/trainees/${t.id}`}
                      className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="font-medium">{t.firstName} {t.lastName}</span>
                          {t.traineeStatus === "remediation" && (
                            <Badge className="ml-2 bg-orange-100 text-orange-800">remediation</Badge>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">{ftoNames.length > 0 ? ftoNames.join(", ") : "Unassigned"}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">
                          Phase: <span className="text-foreground">{currentPhase ?? "—"}</span>
                          {" "}({phasesCompleted}/{t.traineePhases.length})
                        </span>
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-muted-foreground">Skills:</span>
                          <Progress value={skillPct} className="h-2 flex-1" />
                          <span className="text-muted-foreground">{skillPct}%</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent DORs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent DORs</CardTitle>
              <CardDescription>Latest Daily Observation Reports</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/field-training/dors">View All <ArrowRight className="h-4 w-4 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentDors.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No DORs yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Trainee</TableHead>
                    <TableHead>FTO</TableHead>
                    <TableHead>Rating</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentDors.map((dor) => (
                    <TableRow key={dor.id}>
                      <TableCell className="text-sm">{formatDate(dor.date)}</TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/field-training/trainees/${dor.trainee.id}`}
                          className="text-nmh-teal hover:underline"
                        >
                          {dor.trainee.firstName} {dor.trainee.lastName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {dor.fto.firstName} {dor.fto.lastName}
                      </TableCell>
                      <TableCell>
                        <RatingBadge rating={dor.overallRating} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-4 gap-4">
        <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
          <Link href="/admin/field-training/dors/new">
            <ClipboardCheck className="h-5 w-5" />
            New DOR
          </Link>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
          <Link href="/admin/field-training/ftos">
            <UserCheck className="h-5 w-5" />
            Manage FTOs
          </Link>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
          <Link href="/admin/field-training/skills">
            <BookOpen className="h-5 w-5" />
            Manage Skills
          </Link>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
          <Link href="/admin/field-training/settings">
            <Users className="h-5 w-5" />
            Settings
          </Link>
        </Button>
      </div>
    </div>
  );
}
