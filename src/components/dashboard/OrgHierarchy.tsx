"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { NMH_COLORS } from "@/lib/constants";

interface OrgDivision {
  id: string;
  name: string;
  slug: string;
  departments: Array<{ id: string; name: string }>;
}

interface OrgHierarchyProps {
  metricSlug: string;
  divisions: OrgDivision[];
  activeContext: "global" | "division" | "department";
  activeDivisionSlug?: string;
}

/**
 * Visual organizational hierarchy tree for metric drill-down.
 *
 * Layout:
 *
 *        ┌───────────────────┐
 *        │  All Divisions    │  ← clickable → /metric/{slug}
 *        └───────┬───────────┘
 *       ┌────────┼──────────┐
 *       ▼        ▼          ▼
 *  [Air Care] [Ground]  [Comm Para]  ← clickable → /division/{slug}/metric/{slug}
 *       |        |          |
 *    ┌──┼──┐  ┌──┼──┐   ┌──┼──┐
 *    ▼  ▼  ▼  ▼  ▼  ▼   ▼  ▼  ▼
 *  AC1 AC2.. B  D  ..   C1 C2 ..    ← department names (leaf nodes, no link)
 */
export function OrgHierarchy({
  metricSlug,
  divisions,
  activeContext,
  activeDivisionSlug,
}: OrgHierarchyProps) {
  if (divisions.length === 0) return null;

  const isGlobalActive = activeContext === "global";

  return (
    <div className="flex flex-col items-center gap-0 select-none overflow-x-auto pb-2">
      {/* Root node: "All Divisions" */}
      <OrgNodeBox
        label="All Divisions"
        isActive={isGlobalActive}
        href={`/metric/${metricSlug}`}
        level="root"
      />

      {/* Vertical connector from root to division rail */}
      <div className="w-px h-5" style={{ backgroundColor: NMH_COLORS.lightGray }} />

      {/* Division level */}
      <div className="relative flex items-start justify-center">
        {/* Horizontal line across divisions */}
        {divisions.length > 1 && (
          <div
            className="absolute top-0 h-px"
            style={{
              backgroundColor: NMH_COLORS.lightGray,
              left: `calc(${(100 / divisions.length) * 0.5}%)`,
              right: `calc(${(100 / divisions.length) * 0.5}%)`,
            }}
          />
        )}

        {/* Division nodes with their department children */}
        <div className="flex items-start gap-4 flex-wrap justify-center">
          {divisions.map((div) => {
            const isDivisionActive =
              activeContext === "division" && activeDivisionSlug === div.slug;

            return (
              <div key={div.id} className="flex flex-col items-center">
                {/* Vertical drop from horizontal rail */}
                <div className="w-px h-4" style={{ backgroundColor: NMH_COLORS.lightGray }} />

                {/* Division node */}
                <OrgNodeBox
                  label={div.name}
                  isActive={isDivisionActive}
                  href={`/division/${div.slug}/metric/${metricSlug}`}
                  level="division"
                />

                {/* Department children */}
                {div.departments.length > 0 && (
                  <>
                    <div className="w-px h-3" style={{ backgroundColor: NMH_COLORS.lightGray }} />
                    <div className="flex items-start gap-1.5 flex-wrap justify-center max-w-[220px]">
                      {div.departments.map((dept) => (
                        <span
                          key={dept.id}
                          className="text-[10px] leading-tight text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5 whitespace-nowrap"
                        >
                          {dept.name}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function OrgNodeBox({
  label,
  isActive,
  href,
  level,
}: {
  label: string;
  isActive: boolean;
  href: string;
  level: "root" | "division";
}) {
  const box = (
    <div
      className={cn(
        "relative rounded-lg border-2 px-3 py-2 text-center transition-all",
        isActive
          ? "border-[#00b0ad] bg-[#00b0ad]/5 shadow-sm shadow-[#00b0ad]/10"
          : "border-border bg-card hover:border-[#00b0ad]/40 hover:bg-muted/30",
        level === "root" ? "min-w-[160px] px-5" : "min-w-[120px]"
      )}
    >
      {/* Active indicator dot */}
      {isActive && (
        <div className="absolute -top-1.5 -right-1.5 size-3 rounded-full bg-[#00b0ad] border-2 border-background" />
      )}
      <p
        className={cn(
          "font-medium leading-tight",
          level === "root" ? "text-sm" : "text-xs",
          isActive ? "text-[#00b0ad]" : "text-foreground"
        )}
      >
        {label}
      </p>
      {isActive && <p className="text-[10px] text-[#00b0ad]/70 mt-0.5 font-medium">Viewing</p>}
    </div>
  );

  if (isActive) {
    return box;
  }

  return (
    <Link href={href} className="block">
      {box}
    </Link>
  );
}
