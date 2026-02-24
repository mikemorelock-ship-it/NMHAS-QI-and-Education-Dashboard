import Link from "next/link";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { formatPeriod, formatMetricValue } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2,
  BarChart3,
  PenLine,
  Users,
  ArrowRight,
  Clock,
  GitBranchPlus,
  RefreshCcw,
  AlertCircle,
  Shield,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const session = await verifySession();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    departmentCount,
    metricCount,
    regionCount,
    totalEntries,
    entriesThisMonth,
    entriesLastMonth,
    recentEntries,
    recentAuditLogs,
    departments,
    diagramCount,
    activePdsaCount,
    pendingApprovals,
    recentLoginAttempts,
  ] = await Promise.all([
    prisma.department.count(),
    prisma.metricDefinition.count(),
    prisma.region.count(),
    prisma.metricEntry.count(),
    prisma.metricEntry.count({
      where: { createdAt: { gte: monthStart } },
    }),
    prisma.metricEntry.count({
      where: {
        createdAt: { gte: lastMonthStart, lt: monthStart },
      },
    }),
    prisma.metricEntry.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        metricDefinition: {
          select: { name: true, unit: true, rateMultiplier: true, rateSuffix: true },
        },
        department: { select: { name: true } },
        division: { select: { name: true } },
      },
    }),
    prisma.auditLog.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
    }),
    prisma.department.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { metricDefinitions: true, divisions: true, metricEntries: true },
        },
      },
    }),
    prisma.driverDiagram.count({ where: { isActive: true } }),
    prisma.pdsaCycle.count({
      where: { status: { notIn: ["completed", "abandoned"] } },
    }),
    session?.role === "admin"
      ? prisma.user.count({ where: { status: "pending" } })
      : Promise.resolve(0),
    prisma.loginAttempt.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        identifier: true,
        success: true,
        reason: true,
        ipAddress: true,
        createdAt: true,
      },
    }),
  ]);

  const stats = [
    {
      label: "Departments",
      value: departmentCount,
      icon: Building2,
      href: "/admin/departments",
      color: "text-nmh-teal",
    },
    {
      label: "Metric Definitions",
      value: metricCount,
      icon: BarChart3,
      href: "/admin/metrics",
      color: "text-nmh-orange",
    },
    {
      label: "Regions",
      value: regionCount,
      icon: Users,
      href: "/admin/resources",
      color: "text-nmh-teal",
    },
    {
      label: "Driver Diagrams",
      value: diagramCount,
      icon: GitBranchPlus,
      href: "/admin/driver-diagrams",
      color: "text-nmh-teal",
    },
    {
      label: "Active PDSA Cycles",
      value: activePdsaCount,
      icon: RefreshCcw,
      href: "/admin/change-ideas",
      color: "text-nmh-orange",
    },
    {
      label: "Entries This Month",
      value: entriesThisMonth,
      icon: PenLine,
      href: "/admin/data-entry",
      color: "text-nmh-orange",
      subtitle: entriesLastMonth > 0 ? `${entriesLastMonth} last month` : undefined,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-nmh-gray">Dashboard Administration</h1>
        <p className="text-muted-foreground mt-1">
          Manage departments, metrics, and data entries for the EMS Dashboard.
        </p>
      </div>

      {/* Pending Approvals Banner (admin only) */}
      {pendingApprovals > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-nmh-orange/30 bg-nmh-orange/5 p-4">
          <AlertCircle className="h-5 w-5 text-nmh-orange shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-nmh-gray">
              {pendingApprovals} account{pendingApprovals !== 1 ? "s" : ""} awaiting approval
            </p>
            <p className="text-xs text-muted-foreground">
              Review pending account requests to grant dashboard access.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="border-nmh-orange text-nmh-orange hover:bg-nmh-orange/10"
          >
            <Link href="/admin/users">Review</Link>
          </Button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-nmh-gray">
                  {stat.value.toLocaleString()}
                </div>
                {stat.subtitle && (
                  <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department Overview - takes 1 column */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-nmh-gray text-base">Departments</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/departments">
                View all
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {departments.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">No departments yet.</p>
            ) : (
              <div className="space-y-3">
                {departments.map((dept) => (
                  <div key={dept.id} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{dept.name}</span>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${
                          dept.type === "quality"
                            ? "bg-nmh-orange/10 text-nmh-orange"
                            : dept.type === "clinical"
                              ? "bg-nmh-yellow/10 text-nmh-yellow"
                              : dept.type === "operations"
                                ? "bg-nmh-gray/10 text-nmh-gray"
                                : "bg-nmh-teal/10 text-nmh-teal"
                        }`}
                      >
                        {dept.type === "quality"
                          ? "Quality"
                          : dept.type === "clinical"
                            ? "Clinical"
                            : dept.type === "operations"
                              ? "Ops"
                              : "Edu"}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {dept._count.metricDefinitions} metrics &middot; {dept._count.metricEntries}{" "}
                      entries
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Entries - takes 2 columns */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-nmh-gray text-base">Recent Data Entries</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/data-entry">
                Add entry
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentEntries.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">
                No data entries yet. Start by adding departments and metrics.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Division</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.metricDefinition.name}</TableCell>
                      <TableCell>{entry.department.name}</TableCell>
                      <TableCell>
                        {entry.division?.name ?? <span className="text-muted-foreground">--</span>}
                      </TableCell>
                      <TableCell>{formatPeriod(entry.periodStart)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatMetricValue(
                          entry.value,
                          entry.metricDefinition.unit,
                          entry.metricDefinition.rateMultiplier,
                          entry.metricDefinition.rateSuffix
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

      {/* Audit Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-nmh-gray text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentAuditLogs.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">No activity yet.</p>
          ) : (
            <div className="space-y-3">
              {recentAuditLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between gap-4 py-1.5 border-b last:border-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge
                      variant="outline"
                      className={`text-xs shrink-0 ${
                        log.action === "CREATE"
                          ? "border-green-300 text-green-700"
                          : log.action === "DELETE"
                            ? "border-red-300 text-red-700"
                            : log.action === "BULK_CREATE"
                              ? "border-blue-300 text-blue-700"
                              : "border-yellow-300 text-yellow-700"
                      }`}
                    >
                      {log.action}
                    </Badge>
                    <span className="text-sm truncate">
                      {log.details ?? `${log.action} ${log.entity} ${log.entityId}`}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Login Attempts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-nmh-gray text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Recent Login Attempts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentLoginAttempts.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">
              No login attempts recorded yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Identifier</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLoginAttempts.map((attempt) => (
                  <TableRow key={attempt.id}>
                    <TableCell>
                      {attempt.success ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{attempt.identifier}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {attempt.success ? "success" : (attempt.reason ?? "failed")}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {attempt.ipAddress ?? "--"}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(attempt.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Quick summary footer */}
      <p className="text-xs text-muted-foreground text-center">
        Total entries in database: {totalEntries.toLocaleString()}
      </p>
    </div>
  );
}
