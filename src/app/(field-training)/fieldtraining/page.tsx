import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  FileText,
  Users,
  FilePenLine,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  Bell,
  UserPlus,
} from "lucide-react";
import { RequestTraineeButton } from "@/components/field-training/RequestTraineeButton";
import { PendingRequestsCard } from "@/components/field-training/PendingRequestsCard";

export const dynamic = "force-dynamic";

export default async function FieldTrainingDashboardPage() {
  const session = await verifySession();
  if (!session) redirect("/login");

  if (session.role !== "trainee") {
    return <FtoDashboard userId={session.userId} userRole={session.role} />;
  }

  return <TraineeDashboard userId={session.userId} />;
}

// ---------------------------------------------------------------------------
// FTO Dashboard
// ---------------------------------------------------------------------------

async function FtoDashboard({ userId, userRole }: { userId: string; userRole: string }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true },
  });
  if (!user) redirect("/login");

  const canManageAssignments = hasPermission(
    userRole as Parameters<typeof hasPermission>[0],
    "manage_training_assignments"
  );

  const [assignments, recentDors, draftCount, availableTrainees, pendingRequests, myPendingRequests] =
    await Promise.all([
      prisma.trainingAssignment.findMany({
        where: { ftoId: userId, status: "active" },
        include: {
          trainee: {
            select: { firstName: true, lastName: true, employeeId: true, traineeStatus: true },
          },
        },
      }),
      prisma.dailyEvaluation.findMany({
        where: { ftoId: userId },
        orderBy: { date: "desc" },
        take: 5,
        include: {
          trainee: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.dailyEvaluation.count({
        where: { ftoId: userId, status: "draft" },
      }),
      // Available trainees (not currently assigned to this FTO)
      prisma.user.findMany({
        where: {
          role: "trainee",
          isActive: true,
          traineeStatus: { in: ["active", "remediation"] },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        select: { id: true, firstName: true, lastName: true, employeeId: true },
      }),
      // Pending requests for supervisors/managers to review
      canManageAssignments
        ? prisma.assignmentRequest.findMany({
            where: { status: "pending" },
            orderBy: { createdAt: "desc" },
            include: {
              requester: { select: { firstName: true, lastName: true } },
              trainee: { select: { firstName: true, lastName: true, employeeId: true } },
            },
          })
        : [],
      // This FTO's own pending requests
      prisma.assignmentRequest.findMany({
        where: { requesterId: userId, status: "pending" },
        include: {
          trainee: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

  const pendingRequestData = pendingRequests.map((r) => ({
    id: r.id,
    requesterName: `${r.requester.firstName} ${r.requester.lastName}`,
    traineeName: `${r.trainee.lastName}, ${r.trainee.firstName}`,
    traineeEmployeeId: r.trainee.employeeId,
    reason: r.reason,
    createdAt: r.createdAt.toISOString(),
  }));

  const traineeOptions = availableTrainees.map((t) => ({
    id: t.id,
    name: `${t.lastName}, ${t.firstName}`,
    employeeId: t.employeeId,
  }));

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome, {user.firstName} {user.lastName}
          </h1>
          <p className="text-muted-foreground">FTO Dashboard</p>
        </div>
        <div className="flex items-center gap-2">
          <RequestTraineeButton trainees={traineeOptions} />
          <Button asChild>
            <Link href="/fieldtraining/dors/new">
              <Plus className="h-4 w-4 mr-2" />
              New DOR
            </Link>
          </Button>
        </div>
      </div>

      {/* Supervisor/Manager notification card */}
      {canManageAssignments && pendingRequestData.length > 0 && (
        <PendingRequestsCard requests={pendingRequestData} />
      )}

      {/* My pending requests (FTO view) */}
      {myPendingRequests.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-800">
                  {myPendingRequests.length} pending trainee request{myPendingRequests.length > 1 ? "s" : ""}
                </p>
                <p className="text-sm text-blue-700">
                  Awaiting supervisor/manager approval:{" "}
                  {myPendingRequests.map((r) => `${r.trainee.firstName} ${r.trainee.lastName}`).join(", ")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Users className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Assigned Trainees</p>
                <p className="text-2xl font-bold">{assignments.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <FileText className="h-5 w-5 text-purple-700" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total DORs</p>
                <p className="text-2xl font-bold">{recentDors.length > 0 ? "5+" : "0"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100">
                <FilePenLine className="h-5 w-5 text-orange-700" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Drafts</p>
                <p className="text-2xl font-bold">{draftCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assigned Trainees */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Assigned Trainees</CardTitle>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No trainees currently assigned.</p>
          ) : (
            <div className="space-y-2">
              {assignments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div>
                    <p className="font-medium">
                      {a.trainee.lastName}, {a.trainee.firstName}
                    </p>
                    <p className="text-xs text-muted-foreground">ID: {a.trainee.employeeId}</p>
                  </div>
                  <Badge
                    variant={a.trainee.traineeStatus === "active" ? "default" : "secondary"}
                    className="capitalize"
                  >
                    {a.trainee.traineeStatus || "active"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent DORs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent DORs</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/fieldtraining/dors">View All</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentDors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No DORs yet.</p>
          ) : (
            <div className="space-y-2">
              {recentDors.map((dor) => (
                <div
                  key={dor.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium">
                        {dor.trainee.lastName}, {dor.trainee.firstName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(dor.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={dor.status === "draft" ? "outline" : "default"}>
                      {dor.status === "draft" ? "Draft" : "Submitted"}
                    </Badge>
                    <span className="text-sm font-medium">Rating: {dor.overallRating}/7</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trainee Dashboard
// ---------------------------------------------------------------------------

async function TraineeDashboard({ userId }: { userId: string }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true, traineeStatus: true },
  });
  if (!user) redirect("/login");

  const [dorCount, pendingAckCount, phases, skillStats, totalSkills] = await Promise.all([
    prisma.dailyEvaluation.count({
      where: { traineeId: userId, status: "submitted" },
    }),
    prisma.dailyEvaluation.count({
      where: {
        traineeId: userId,
        status: "submitted",
        traineeAcknowledged: false,
      },
    }),
    prisma.traineePhase.findMany({
      where: { traineeId: userId },
      include: { phase: { select: { name: true, sortOrder: true } } },
      orderBy: { phase: { sortOrder: "asc" } },
    }),
    prisma.skillSignoff.count({
      where: { traineeId: userId },
    }),
    prisma.skill.count({
      where: { isActive: true },
    }),
  ]);

  const totalPhases = phases.length;
  const completedPhases = phases.filter((p) => p.status === "completed").length;
  const currentPhase = phases.find((p) => p.status === "in_progress");
  const phaseProgress = totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome, {user.firstName} {user.lastName}
        </h1>
        <p className="text-muted-foreground">Training Dashboard</p>
      </div>

      {/* Pending acknowledgments alert */}
      {pendingAckCount > 0 && (
        <Card className="border-orange-300 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="font-medium text-orange-800">
                    {pendingAckCount} DOR{pendingAckCount > 1 ? "s" : ""} pending acknowledgment
                  </p>
                  <p className="text-sm text-orange-700">
                    Please review and acknowledge your Daily Observation Reports.
                  </p>
                </div>
              </div>
              <Button asChild variant="outline" className="border-orange-300">
                <Link href="/fieldtraining/dors?filter=pending">Review Now</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <FileText className="h-5 w-5 text-purple-700" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total DORs</p>
                <p className="text-2xl font-bold">{dorCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <CheckCircle2 className="h-5 w-5 text-green-700" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Skills Completed</p>
                <p className="text-2xl font-bold">
                  {skillStats}{" "}
                  <span className="text-base font-normal text-muted-foreground">
                    / {totalSkills}
                  </span>
                </p>
              </div>
              <Button asChild variant="ghost" size="icon">
                <Link href="/fieldtraining/skills">
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100">
                <Clock className="h-5 w-5 text-orange-700" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Acknowledgment</p>
                <p className="text-2xl font-bold">{pendingAckCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Phase Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Training Phase Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {completedPhases} of {totalPhases} phases completed
            </span>
            <span className="font-medium">{phaseProgress}%</span>
          </div>
          <Progress value={phaseProgress} className="h-3" />

          {currentPhase && (
            <p className="text-sm">
              Current Phase:{" "}
              <span className="font-medium">{currentPhase.phase.name}</span>
            </p>
          )}

          <div className="space-y-2 mt-4">
            {phases.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-2 rounded-lg border"
              >
                <span className="text-sm font-medium">{p.phase.name}</span>
                <Badge
                  variant={
                    p.status === "completed"
                      ? "default"
                      : p.status === "in_progress"
                        ? "secondary"
                        : "outline"
                  }
                  className={p.status === "completed" ? "bg-green-600" : ""}
                >
                  {p.status === "completed"
                    ? "Completed"
                    : p.status === "in_progress"
                      ? "In Progress"
                      : "Not Started"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
