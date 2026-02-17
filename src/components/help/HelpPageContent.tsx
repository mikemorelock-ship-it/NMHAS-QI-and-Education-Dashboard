"use client";

import { useState, useMemo, useEffect } from "react";
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
  Search,
  BookOpen,
  Lightbulb,
  ArrowRight,
  Sparkles,
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
};

function getIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? BookOpen;
}

// ---------------------------------------------------------------------------
// Feature Accordion Item
// ---------------------------------------------------------------------------

function FeatureItem({ feature }: { feature: HelpFeature }) {
  const Icon = getIcon(feature.icon);

  return (
    <AccordionItem value={feature.id}>
      <AccordionTrigger className="hover:no-underline">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-nmh-teal/10 shrink-0">
            <Icon className="size-4 text-nmh-teal" />
          </div>
          <span className="text-sm font-semibold">{feature.title}</span>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="pl-11 space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {feature.description}
          </p>

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
              <Badge
                key={rt}
                variant="secondary"
                className="text-[10px] px-1.5 py-0"
              >
                {rt}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {term.definition}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function HelpPageContent({ portal }: { portal: PortalId }) {
  const [featureSearch, setFeatureSearch] = useState("");
  const [glossarySearch, setGlossarySearch] = useState("");
  const [lastSeenDate, setLastSeenDate] = useState<string | null>(null);

  const meta = PORTAL_META[portal];
  const allFeatures = useMemo(() => getFeaturesForPortal(portal), [portal]);
  const allGlossary = useMemo(() => getGlossaryForPortal(portal), [portal]);

  // On mount: read last-seen date, then mark all updates as seen
  useEffect(() => {
    const stored = localStorage.getItem(CHANGELOG_STORAGE_KEY);
    setLastSeenDate(stored);
    // Mark as seen after a brief delay so "New" badges render first
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

      {/* Recent Updates section */}
      {CHANGELOG.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-nmh-teal" />
            <h2 className="text-lg font-semibold">Recent Updates</h2>
          </div>

          <Card>
            <CardContent className="pt-4 pb-2 divide-y">
              {CHANGELOG.map((entry, i) => {
                const isNew = !lastSeenDate || entry.date > lastSeenDate;
                const catColor = CATEGORY_COLORS[entry.category];
                return (
                  <div key={i} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono px-1.5 py-0"
                      >
                        {entry.date}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0"
                        style={{ backgroundColor: `${catColor}20`, color: catColor }}
                      >
                        {CATEGORY_LABELS[entry.category]}
                      </Badge>
                      {isNew && (
                        <Badge className="bg-nmh-teal text-white text-[10px] px-1.5 py-0 animate-pulse">
                          New
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      {entry.title}
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">
                      {entry.description}
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
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
              filteredGlossary.map((term) => (
                <GlossaryCard key={term.term} term={term} />
              ))
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
