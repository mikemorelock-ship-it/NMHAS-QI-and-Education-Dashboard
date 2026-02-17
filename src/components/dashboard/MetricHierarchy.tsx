"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { NMH_COLORS } from "@/lib/constants";
import type { ChildMetricSummary } from "@/types";

interface HierarchyNode {
  id: string;
  name: string;
  slug: string;
  isCurrent: boolean;
}

interface MetricHierarchyProps {
  departmentSlug: string;
  currentMetricId: string;
  currentMetricName: string;
  currentMetricSlug: string;
  parentMetric: { id: string; name: string; slug: string } | null;
  siblingMetrics: { id: string; name: string; slug: string }[];
  childMetrics: ChildMetricSummary[];
  /** Override the base path for metric links (e.g., "/metric" for global, "/division/air-care/metric" for division) */
  linkBasePath?: string;
}

/**
 * Visual hierarchy chart showing parent-child metric relationships.
 *
 * Layout:
 *
 *   [ Parent Metric ]        ← top level (linked)
 *         |
 *    ┌────┼────┐
 *    ▼    ▼    ▼
 *  [A]  [B*]  [C]            ← children level (* = current if viewing child)
 *
 * When viewing a parent: parent is emphasized, children shown below.
 * When viewing a child: parent is above, current + siblings shown at bottom.
 */
export function MetricHierarchy({
  departmentSlug,
  currentMetricId,
  currentMetricName,
  currentMetricSlug,
  parentMetric,
  siblingMetrics,
  childMetrics,
  linkBasePath,
}: MetricHierarchyProps) {
  const isChildView = parentMetric !== null;
  const isParentView = !isChildView && childMetrics.length > 0;

  // Nothing to show for standalone metrics
  if (!isChildView && !isParentView) return null;

  // Build the tree structure
  let topNode: HierarchyNode;
  let bottomNodes: HierarchyNode[];

  if (isChildView && parentMetric) {
    // Viewing a child metric: parent on top, self + siblings on bottom
    topNode = {
      id: parentMetric.id,
      name: parentMetric.name,
      slug: parentMetric.slug,
      isCurrent: false,
    };
    bottomNodes = [
      {
        id: currentMetricId,
        name: currentMetricName,
        slug: currentMetricSlug,
        isCurrent: true,
      },
      ...siblingMetrics.map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        isCurrent: false,
      })),
    ];
  } else {
    // Viewing a parent metric: self on top, children on bottom
    topNode = {
      id: currentMetricId,
      name: currentMetricName,
      slug: currentMetricSlug,
      isCurrent: true,
    };
    bottomNodes = childMetrics.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      isCurrent: false,
    }));
  }

  return (
    <div className="flex flex-col items-center gap-0 select-none">
      {/* Top node (parent) */}
      <HierarchyNodeBox
        node={topNode}
        departmentSlug={departmentSlug}
        linkBasePath={linkBasePath}
        level="parent"
      />

      {/* Vertical connector from parent down to horizontal line */}
      <div
        className="w-px h-6"
        style={{ backgroundColor: NMH_COLORS.lightGray }}
      />

      {/* Horizontal rail + vertical drops to children */}
      {bottomNodes.length > 0 && (
        <div className="relative flex items-start justify-center">
          {/* Horizontal connecting line spanning from first to last child center */}
          {bottomNodes.length > 1 && (
            <div
              className="absolute top-0 h-px"
              style={{
                backgroundColor: NMH_COLORS.lightGray,
                left: `calc(${(100 / bottomNodes.length) * 0.5}%)`,
                right: `calc(${(100 / bottomNodes.length) * 0.5}%)`,
              }}
            />
          )}

          {/* Child nodes */}
          <div className="flex items-start gap-3 flex-wrap justify-center">
            {bottomNodes.map((node) => (
              <div key={node.id} className="flex flex-col items-center">
                {/* Vertical drop from horizontal rail */}
                <div
                  className="w-px h-5"
                  style={{ backgroundColor: NMH_COLORS.lightGray }}
                />
                <HierarchyNodeBox
                  node={node}
                  departmentSlug={departmentSlug}
                  linkBasePath={linkBasePath}
                  level="child"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HierarchyNodeBox({
  node,
  departmentSlug,
  linkBasePath,
  level,
}: {
  node: HierarchyNode;
  departmentSlug: string;
  linkBasePath?: string;
  level: "parent" | "child";
}) {
  const isParentLevel = level === "parent";

  const box = (
    <div
      className={cn(
        "relative rounded-lg border-2 px-4 py-2.5 text-center transition-all max-w-[200px]",
        node.isCurrent
          ? "border-[#00b0ad] bg-[#00b0ad]/5 shadow-sm shadow-[#00b0ad]/10"
          : "border-border bg-card hover:border-[#00b0ad]/40 hover:bg-muted/30",
        isParentLevel ? "min-w-[180px]" : "min-w-[140px]"
      )}
    >
      {/* Current indicator dot */}
      {node.isCurrent && (
        <div className="absolute -top-1.5 -right-1.5 size-3 rounded-full bg-[#00b0ad] border-2 border-background" />
      )}
      <p
        className={cn(
          "font-medium leading-tight",
          isParentLevel ? "text-sm" : "text-xs",
          node.isCurrent ? "text-[#00b0ad]" : "text-foreground"
        )}
      >
        {node.name}
      </p>
      {node.isCurrent && (
        <p className="text-[10px] text-[#00b0ad]/70 mt-0.5 font-medium">
          Viewing
        </p>
      )}
    </div>
  );

  if (node.isCurrent) {
    return box;
  }

  const href = linkBasePath
    ? `${linkBasePath}/${node.slug}`
    : `/department/${departmentSlug}/metric/${node.slug}`;

  return (
    <Link href={href} className="block">
      {box}
    </Link>
  );
}
