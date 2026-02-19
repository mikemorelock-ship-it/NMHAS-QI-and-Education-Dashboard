import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseDateRangeFilter } from "@/lib/utils";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const range = searchParams.get("range") || "ytd";
    const divisionId = searchParams.get("divisionId") || undefined;
    const ftoId = searchParams.get("ftoId") || undefined;
    const traineeId = searchParams.get("traineeId") || undefined;
    const phaseId = searchParams.get("phaseId") || undefined;

    // Build where clause for DOR queries
    const dorWhere: any = {};

    // Date filter from parseDateRangeFilter
    const dateFilter = parseDateRangeFilter(range);
    if (dateFilter.gte || dateFilter.lte) {
      dorWhere.date = {};
      if (dateFilter.gte) dorWhere.date.gte = dateFilter.gte;
      if (dateFilter.lte) dorWhere.date.lte = dateFilter.lte;
    }

    // Direct filters
    if (traineeId) dorWhere.traineeId = traineeId;
    if (ftoId) dorWhere.ftoId = ftoId;
    if (phaseId) dorWhere.phaseId = phaseId;

    // Division filter (through trainee's division)
    if (divisionId) {
      dorWhere.trainee = { divisionId };
    }

    // Fetch DORs, active trainee count, and filter options in parallel
    const [dors, activeTrainees, divisions, ftos, trainees, phases] = await Promise.all([
      // 1. All matching DORs
      prisma.dailyEvaluation.findMany({
        where: dorWhere,
        orderBy: { date: "desc" },
        include: {
          trainee: { select: { firstName: true, lastName: true } },
          fto: { select: { firstName: true, lastName: true } },
          phase: { select: { name: true } },
        },
      }),
      // 2. Active trainees count
      prisma.user.count({
        where: {
          role: "trainee",
          traineeStatus: "active",
          ...(divisionId ? { divisionId } : {}),
        },
      }),
      // 3. Filter options (always unfiltered for dropdown population)
      prisma.division.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.user.findMany({
        where: { role: { in: ["fto", "supervisor", "manager", "admin"] }, isActive: true },
        orderBy: { lastName: "asc" },
        select: { id: true, firstName: true, lastName: true, divisionId: true },
      }),
      prisma.user.findMany({
        where: { role: "trainee", isActive: true },
        orderBy: { lastName: "asc" },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          divisionId: true,
          traineeStatus: true,
        },
      }),
      prisma.trainingPhase.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true },
      }),
    ]);

    // --- KPIs ---
    const totalDors = dors.length;

    const avgOverallRating =
      totalDors > 0 ? dors.reduce((sum, d) => sum + d.overallRating, 0) / totalDors : 0;

    // Avg rating sparkline: group by month, last 12 months
    const monthlyRatings = new Map<string, number[]>();
    for (const dor of dors) {
      const key = format(dor.date, "yyyy-MM");
      if (!monthlyRatings.has(key)) monthlyRatings.set(key, []);
      monthlyRatings.get(key)!.push(dor.overallRating);
    }
    const sortedMonthKeys = Array.from(monthlyRatings.keys()).sort();
    const last12MonthKeys = sortedMonthKeys.slice(-12);
    const avgRatingSparkline = last12MonthKeys.map((key) => {
      const ratings = monthlyRatings.get(key)!;
      return ratings.reduce((a, b) => a + b, 0) / ratings.length;
    });

    const flagCount = dors.filter((d) => d.nrtFlag || d.remFlag).length;

    // --- Rating Over Time (line chart) ---
    const monthlyGroups = new Map<string, { total: number; count: number; sortKey: string }>();
    for (const dor of dors) {
      const period = format(dor.date, "MMM yyyy");
      const sortKey = format(dor.date, "yyyy-MM");
      if (!monthlyGroups.has(period)) {
        monthlyGroups.set(period, { total: 0, count: 0, sortKey });
      }
      const group = monthlyGroups.get(period)!;
      group.total += dor.overallRating;
      group.count += 1;
    }
    const ratingOverTime = Array.from(monthlyGroups.entries())
      .sort((a, b) => a[1].sortKey.localeCompare(b[1].sortKey))
      .map(([period, { total, count }]) => ({
        period,
        value: total / count,
      }));

    // --- DOR Count Over Time (bar chart) ---
    const dorCountOverTime = Array.from(monthlyGroups.entries())
      .sort((a, b) => a[1].sortKey.localeCompare(b[1].sortKey))
      .map(([period, { count }]) => ({
        period,
        value: count,
      }));

    // --- Rating Distribution ---
    const ratingDistribution = Array.from({ length: 7 }, (_, i) => ({
      rating: i + 1,
      count: 0,
    }));
    for (const dor of dors) {
      if (dor.overallRating >= 1 && dor.overallRating <= 7) {
        ratingDistribution[dor.overallRating - 1].count += 1;
      }
    }

    // --- Category Ratings ---
    const dorIds = dors.map((d) => d.id);
    let categoryRatings: {
      categoryId: string;
      categoryName: string;
      averageRating: number;
      count: number;
    }[] = [];

    if (dorIds.length > 0) {
      const evalRatings = await prisma.evaluationRating.findMany({
        where: { evaluationId: { in: dorIds } },
        include: { category: { select: { id: true, name: true } } },
      });

      const categoryMap = new Map<string, { name: string; total: number; count: number }>();
      for (const er of evalRatings) {
        const catId = er.category.id;
        if (!categoryMap.has(catId)) {
          categoryMap.set(catId, { name: er.category.name, total: 0, count: 0 });
        }
        const cat = categoryMap.get(catId)!;
        cat.total += er.rating;
        cat.count += 1;
      }

      categoryRatings = Array.from(categoryMap.entries())
        .map(([categoryId, { name, total, count }]) => ({
          categoryId,
          categoryName: name,
          averageRating: total / count,
          count,
        }))
        .sort((a, b) => a.categoryName.localeCompare(b.categoryName));
    }

    // --- Recent DORs (last 20) ---
    const recentDors = dors.slice(0, 20).map((dor) => ({
      id: dor.id,
      date: format(dor.date, "yyyy-MM-dd"),
      traineeName: `${dor.trainee.firstName} ${dor.trainee.lastName}`,
      ftoName: `${dor.fto.firstName} ${dor.fto.lastName}`,
      phaseName: dor.phase?.name ?? null,
      overallRating: dor.overallRating,
      recommendAction: dor.recommendAction,
      nrtFlag: dor.nrtFlag,
      remFlag: dor.remFlag,
    }));

    // --- Filters response ---
    const filters = {
      divisions,
      ftos: ftos.map((f) => ({
        id: f.id,
        name: `${f.lastName}, ${f.firstName}`,
        divisionId: f.divisionId,
      })),
      trainees: trainees.map((t) => ({
        id: t.id,
        name: `${t.lastName}, ${t.firstName}`,
        divisionId: t.divisionId,
        status: t.traineeStatus,
      })),
      phases: phases.map((p) => ({
        id: p.id,
        name: p.name,
      })),
    };

    return NextResponse.json({
      kpis: {
        totalDors,
        avgOverallRating,
        avgRatingSparkline,
        activeTrainees,
        flagCount,
      },
      ratingOverTime,
      dorCountOverTime,
      ratingDistribution,
      categoryRatings,
      recentDors,
      filters,
    });
  } catch (error) {
    console.error("Field training dashboard error:", error);
    return NextResponse.json(
      { error: "Failed to fetch field training dashboard data" },
      { status: 500 }
    );
  }
}
