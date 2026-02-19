"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  ClipboardList,
  GitBranchPlus,
  RefreshCcw,
  GraduationCap,
  Building2,
  BarChart3,
  PenLine,
  FileUp,
  FolderOpen,
  Users,
  UserCog,
  FileText,
  FilePlus,
  FileEdit,
  Star,
  MessageSquare,
  CheckCircle,
  ClipboardCheck,
  TrendingUp,
  Settings,
  ScrollText,
  Search,
  BookOpen,
  Lightbulb,
  ArrowRight,
  Sparkles,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  type PortalId,
  type HelpFeature,
  type GlossaryTerm,
  PORTAL_META,
  getFeaturesForPortal,
  getGlossaryForPortal,
} from "@/lib/help-registry";
import {
  CHANGELOG,
  LATEST_CHANGELOG_DATE,
  CHANGELOG_STORAGE_KEY,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  groupByRelease,
  type ChangelogEntry,
  type ReleaseInfo,
} from "@/lib/changelog";

// ---------------------------------------------------------------------------
// Icon resolver — maps string names from registry to lucide components
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  ClipboardList,
  GitBranchPlus,
  RefreshCcw,
  GraduationCap,
  Building2,
  BarChart3,
  PenLine,
  FileUp,
  FolderOpen,
  Users,
  UserCog,
  FileText,
  FilePlus,
  FileEdit,
  Star,
  MessageSquare,
  CheckCircle,
  ClipboardCheck,
  TrendingUp,
  Settings,
  ScrollText,
  BookOpen,
};

function getIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? BookOpen;
}

/** Stable wrapper that resolves a string icon name to a Lucide component.
 *  Uses createElement to avoid the react-hooks/static-components lint rule
 *  from flagging the dynamic component lookup as "creating during render". */
function DynamicIcon({ name, ...props }: { name: string } & React.SVGAttributes<SVGSVGElement>) {
  return React.createElement(getIcon(name), props);
}

// ---------------------------------------------------------------------------
// Feature Accordion Item
// ---------------------------------------------------------------------------

function FeatureItem({ feature }: { feature: HelpFeature }) {
  return (
    <AccordionItem value={feature.id}>
      <AccordionTrigger className="hover:no-underline">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-nmh-teal/10 shrink-0">
            <DynamicIcon name={feature.icon} className="size-4 text-nmh-teal" />
          </div>
          <span className="text-sm font-semibold">{feature.title}</span>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="pl-11 space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>

          {feature.tips && feature.tips.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-nmh-gray">
                <Lightbulb className="size-3.5" />
                Tips
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {feature.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-nmh-teal/50 shrink-0" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {feature.path && (
            <Button variant="outline" size="sm" asChild className="mt-1">
              <Link href={feature.path}>
                Go to {feature.title}
                <ArrowRight className="size-3.5 ml-1" />
              </Link>
            </Button>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

// ---------------------------------------------------------------------------
// Glossary Card
// ---------------------------------------------------------------------------

function GlossaryCard({ term }: { term: GlossaryTerm }) {
  return (
    <div className="py-3 space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-bold text-foreground">{term.term}</span>
        {term.relatedTerms && term.relatedTerms.length > 0 && (
          <div className="flex items-center gap-1">
            {term.relatedTerms.map((rt) => (
              <Badge key={rt} variant="secondary" className="text-[10px] px-1.5 py-0">
                {rt}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{term.definition}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible Release Group
// ---------------------------------------------------------------------------

function ReleaseGroup({
  release,
  entries,
  isLatest,
  defaultOpen,
  lastSeenDate,
}: {
  release: ReleaseInfo;
  entries: ChangelogEntry[];
  isLatest: boolean;
  defaultOpen: boolean;
  lastSeenDate: string | null;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const featureCount = entries.filter((e) => e.category === "feature").length;
  const improvementCount = entries.filter((e) => e.category === "improvement").length;
  const fixCount = entries.filter((e) => e.category === "fix").length;
  const newCount = entries.filter((e) => !lastSeenDate || e.date > lastSeenDate).length;

  return (
    <div
      className={`rounded-lg border transition-colors ${
        isLatest ? "border-nmh-teal/40 bg-nmh-teal/[0.02] shadow-sm" : "border-border"
      }`}
    >
      {/* Clickable header */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors rounded-lg"
      >
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
            open ? "rotate-0" : "-rotate-90"
          }`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{release.version}</span>
            {isLatest && (
              <Badge className="bg-nmh-teal text-white text-[10px] px-1.5 py-0">Latest</Badge>
            )}
            {newCount > 0 && !isLatest && (
              <Badge className="bg-nmh-teal text-white text-[10px] px-1.5 py-0 animate-pulse">
                {newCount} New
              </Badge>
            )}
            <span className="text-xs text-muted-foreground hidden sm:inline">{release.label}</span>
          </div>
          {/* Summary counts */}
          <div className="flex items-center gap-3 mt-1">
            {featureCount > 0 && (
              <span className="text-[11px] text-muted-foreground">
                <span
                  className="inline-block w-2 h-2 rounded-full mr-1"
                  style={{ backgroundColor: CATEGORY_COLORS.feature }}
                />
                {featureCount} feature{featureCount !== 1 ? "s" : ""}
              </span>
            )}
            {improvementCount > 0 && (
              <span className="text-[11px] text-muted-foreground">
                <span
                  className="inline-block w-2 h-2 rounded-full mr-1"
                  style={{ backgroundColor: CATEGORY_COLORS.improvement }}
                />
                {improvementCount} improvement{improvementCount !== 1 ? "s" : ""}
              </span>
            )}
            {fixCount > 0 && (
              <span className="text-[11px] text-muted-foreground">
                <span
                  className="inline-block w-2 h-2 rounded-full mr-1"
                  style={{ backgroundColor: CATEGORY_COLORS.fix }}
                />
                {fixCount} fix{fixCount !== 1 ? "es" : ""}
              </span>
            )}
          </div>
        </div>
        <span className="text-xs text-muted-foreground font-mono shrink-0">
          {entries.length} update{entries.length !== 1 ? "s" : ""}
        </span>
      </button>

      {/* Collapsible entries */}
      {open && (
        <div className="px-4 pb-3 divide-y border-t">
          {entries.map((entry, i) => {
            const isNew = !lastSeenDate || entry.date > lastSeenDate;
            const catColor = CATEGORY_COLORS[entry.category];
            return (
              <div key={i} className="py-3 first:pt-3 last:pb-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                    {entry.date}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0"
                    style={{
                      backgroundColor: `${catColor}20`,
                      color: catColor,
                    }}
                  >
                    {CATEGORY_LABELS[entry.category]}
                  </Badge>
                  {isNew && (
                    <Badge className="bg-nmh-teal text-white text-[10px] px-1.5 py-0 animate-pulse">
                      New
                    </Badge>
                  )}
                </div>
                <p className="text-sm font-semibold text-foreground">{entry.title}</p>
                <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">
                  {entry.description}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function HelpPageContent({ portal }: { portal: PortalId }) {
  const [featureSearch, setFeatureSearch] = useState("");
  const [glossarySearch, setGlossarySearch] = useState("");
  const [lastSeenDate] = useState<string | null>(() => localStorage.getItem(CHANGELOG_STORAGE_KEY));

  const meta = PORTAL_META[portal];
  const allFeatures = useMemo(() => getFeaturesForPortal(portal), [portal]);
  const allGlossary = useMemo(() => getGlossaryForPortal(portal), [portal]);
  const releaseGroups = useMemo(() => groupByRelease(), []);

  // Mark all updates as seen after a brief delay so "New" badges render first
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(CHANGELOG_STORAGE_KEY, LATEST_CHANGELOG_DATE);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const filteredFeatures = useMemo(() => {
    if (!featureSearch.trim()) return allFeatures;
    const q = featureSearch.toLowerCase();
    return allFeatures.filter(
      (f) =>
        f.title.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.tips?.some((t) => t.toLowerCase().includes(q))
    );
  }, [allFeatures, featureSearch]);

  const filteredGlossary = useMemo(() => {
    if (!glossarySearch.trim()) return allGlossary;
    const q = glossarySearch.toLowerCase();
    return allGlossary.filter(
      (t) =>
        t.term.toLowerCase().includes(q) ||
        t.definition.toLowerCase().includes(q) ||
        t.relatedTerms?.some((rt) => rt.toLowerCase().includes(q))
    );
  }, [allGlossary, glossarySearch]);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-nmh-gray">{meta.title}</h1>
        <p className="text-muted-foreground mt-1">{meta.description}</p>
      </div>

      {/* Updates section — collapsible by release */}
      {releaseGroups.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-nmh-teal" />
            <h2 className="text-lg font-semibold">Updates</h2>
            <span className="text-xs text-muted-foreground">
              {CHANGELOG.length} total across {releaseGroups.length} release
              {releaseGroups.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="space-y-3">
            {releaseGroups.map((group, idx) => (
              <ReleaseGroup
                key={group.release.version}
                release={group.release}
                entries={group.entries}
                isLatest={idx === 0}
                defaultOpen={false}
                lastSeenDate={lastSeenDate}
              />
            ))}
          </div>
        </section>
      )}

      <Separator />

      {/* Features section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BookOpen className="size-5 text-nmh-teal" />
            <h2 className="text-lg font-semibold">Features & Navigation</h2>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search features..."
              value={featureSearch}
              onChange={(e) => setFeatureSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {filteredFeatures.length > 0 ? (
              <Accordion type="multiple" className="px-4">
                {filteredFeatures.map((feature) => (
                  <FeatureItem key={feature.id} feature={feature} />
                ))}
              </Accordion>
            ) : (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No features match &ldquo;{featureSearch}&rdquo;
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* Glossary section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BookOpen className="size-5 text-nmh-orange" />
            <h2 className="text-lg font-semibold">Glossary of Terms</h2>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search terms..."
              value={glossarySearch}
              onChange={(e) => setGlossarySearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        <Card>
          <CardContent className="pt-1 pb-2 divide-y">
            {filteredGlossary.length > 0 ? (
              filteredGlossary.map((term) => <GlossaryCard key={term.term} term={term} />)
            ) : (
              <div className="py-8 text-center text-muted-foreground text-sm">
                No terms match &ldquo;{glossarySearch}&rdquo;
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
