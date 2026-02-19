"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  LayoutDashboard,
  GitBranchPlus,
  Building2,
  Shield,
  ClipboardList,
  FileText,
  Wand2,
  AlertTriangle,
  Settings,
  Heart,
  Search,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Printer,
  ArrowUp,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  GUIDE_SECTIONS,
  getTableOfContents,
  type GuideSection,
  type GuideSubsection,
} from "@/lib/developer-guide";

// ---------------------------------------------------------------------------
// Icon resolver
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  GitBranchPlus,
  Building2,
  Shield,
  ClipboardList,
  FileText,
  Wand2,
  AlertTriangle,
  Settings,
  Heart,
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
// Text renderer — converts plain text with conventions to styled elements
// ---------------------------------------------------------------------------

function ContentBlock({ text }: { text: string }) {
  // Split by double-newline into paragraphs, handle bullet lists and labeled sections
  const paragraphs = text.split("\n\n");

  return (
    <div className="space-y-3">
      {paragraphs.map((para, i) => {
        // Check if this paragraph is a list (starts with • or numbered)
        const lines = para.split("\n");
        const isBulletList = lines.every(
          (l) => l.startsWith("•") || l.startsWith("  ") || l.trim() === ""
        );
        const isNumberedList = lines.every(
          (l) => /^\d+\./.test(l) || l.startsWith("  ") || l.trim() === ""
        );

        if (isBulletList) {
          return (
            <ul key={i} className="space-y-1.5 text-sm text-muted-foreground leading-relaxed">
              {lines
                .filter((l) => l.trim())
                .map((line, j) => (
                  <li key={j} className="flex items-start gap-2">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-nmh-teal/50 shrink-0" />
                    <span>
                      <InlineFormatted text={line.replace(/^•\s*/, "")} />
                    </span>
                  </li>
                ))}
            </ul>
          );
        }

        if (isNumberedList) {
          return (
            <ol
              key={i}
              className="space-y-1.5 text-sm text-muted-foreground leading-relaxed list-decimal list-inside"
            >
              {lines
                .filter((l) => l.trim())
                .map((line, j) => (
                  <li key={j}>
                    <InlineFormatted text={line.replace(/^\d+\.\s*/, "")} />
                  </li>
                ))}
            </ol>
          );
        }

        // Check if it's a label line (ALL CAPS followed by colon)
        if (/^[A-Z][A-Z _/()-]+:/.test(para)) {
          const colonIdx = para.indexOf(":");
          const label = para.slice(0, colonIdx);
          const rest = para.slice(colonIdx + 1).trim();
          return (
            <div key={i} className="text-sm leading-relaxed">
              <span className="font-semibold text-foreground">{label}:</span>{" "}
              <span className="text-muted-foreground">
                <InlineFormatted text={rest} />
              </span>
            </div>
          );
        }

        // Check for table-like content (lines with → or —)
        if (para.includes("→") && lines.length > 1) {
          return (
            <div
              key={i}
              className="font-mono text-xs bg-muted/50 rounded-md p-3 space-y-1 overflow-x-auto"
            >
              {lines.map((line, j) => (
                <div key={j} className="text-muted-foreground whitespace-pre">
                  {line}
                </div>
              ))}
            </div>
          );
        }

        // Regular paragraph
        return (
          <p key={i} className="text-sm text-muted-foreground leading-relaxed">
            <InlineFormatted text={para} />
          </p>
        );
      })}
    </div>
  );
}

/**
 * Handles inline formatting: 'code', ALLCAPS labels, and file paths.
 */
function InlineFormatted({ text }: { text: string }) {
  // Split on single-quoted code spans
  const parts = text.split(/('[\w./:@\\-]+(?:\(\))?')/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("'") && part.endsWith("'")) {
          return (
            <code
              key={i}
              className="text-xs bg-muted px-1 py-0.5 rounded font-mono text-foreground"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Section component
// ---------------------------------------------------------------------------

function SectionCard({
  section,
  isExpanded,
  onToggle,
  searchQuery,
}: {
  section: GuideSection;
  isExpanded: boolean;
  onToggle: () => void;
  searchQuery: string;
}) {
  const allSubIds = useMemo(
    () => new Set(section.subsections?.map((s) => s.id) ?? []),
    [section.subsections]
  );
  const [manualExpandedSubs, setManualExpandedSubs] = useState<Set<string>>(allSubIds);

  // When searching, force all subs expanded; otherwise use manual toggles
  const expandedSubs = searchQuery ? allSubIds : manualExpandedSubs;

  const toggleSub = (id: string) => {
    setManualExpandedSubs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Card id={section.id} className="scroll-mt-20">
      {/* Section header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-muted/30 transition-colors rounded-t-lg"
      >
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-nmh-teal/10 shrink-0">
          <DynamicIcon name={section.icon} className="size-5 text-nmh-teal" />
        </div>
        <h2 className="text-base font-bold text-foreground flex-1">{section.title}</h2>
        <Badge variant="outline" className="text-[10px] px-1.5 font-mono">
          {section.subsections?.length ?? 0} topics
        </Badge>
        <ChevronDown
          className={`size-4 text-muted-foreground transition-transform duration-200 ${
            isExpanded ? "rotate-0" : "-rotate-90"
          }`}
        />
      </button>

      {isExpanded && (
        <CardContent className="pt-0 pb-6 px-6 space-y-4">
          {/* Section intro */}
          <div className="pl-12">
            <ContentBlock text={section.content} />
          </div>

          {/* Subsections */}
          {section.subsections && section.subsections.length > 0 && (
            <div className="pl-12 space-y-2">
              {section.subsections.map((sub) => (
                <SubsectionItem
                  key={sub.id}
                  subsection={sub}
                  isExpanded={expandedSubs.has(sub.id)}
                  onToggle={() => toggleSub(sub.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function SubsectionItem({
  subsection,
  isExpanded,
  onToggle,
}: {
  subsection: GuideSubsection;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div id={subsection.id} className="scroll-mt-20 border rounded-lg">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/30 transition-colors rounded-lg"
      >
        {isExpanded ? (
          <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
        )}
        <h3 className="text-sm font-semibold text-foreground">{subsection.title}</h3>
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 pl-9">
          <ContentBlock text={subsection.content} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table of Contents (sidebar)
// ---------------------------------------------------------------------------

function TableOfContents({ onNavigate }: { onNavigate: (id: string) => void }) {
  const toc = useMemo(() => getTableOfContents(), []);

  return (
    <nav className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contents</h3>
      {toc.map((section) => (
        <div key={section.id}>
          <button
            type="button"
            onClick={() => onNavigate(section.id)}
            className="flex items-center gap-2 text-sm font-medium text-foreground/80 hover:text-nmh-teal transition-colors w-full text-left"
          >
            <DynamicIcon name={section.icon} className="size-3.5 shrink-0" />
            {section.title}
          </button>
          {section.subsections.length > 0 && (
            <div className="ml-5 mt-1 space-y-0.5 border-l border-border pl-2">
              {section.subsections.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => onNavigate(sub.id)}
                  className="block text-xs text-muted-foreground hover:text-nmh-teal transition-colors py-0.5 w-full text-left"
                >
                  {sub.title}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DeveloperGuideContent() {
  const [search, setSearch] = useState("");
  const [manualExpandedSections, setManualExpandedSections] = useState<Set<string>>(
    new Set(GUIDE_SECTIONS.map((s) => s.id))
  );
  const [showBackToTop, setShowBackToTop] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Track scroll for back-to-top button
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Filter sections by search
  const filteredSections = useMemo(() => {
    if (!search.trim()) return GUIDE_SECTIONS;
    const q = search.toLowerCase();
    return GUIDE_SECTIONS.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.content.toLowerCase().includes(q) ||
        s.subsections?.some(
          (sub) => sub.title.toLowerCase().includes(q) || sub.content.toLowerCase().includes(q)
        )
    );
  }, [search]);

  // When searching, force all filtered sections expanded; otherwise use manual state
  const expandedSections = useMemo(() => {
    if (search.trim()) {
      return new Set(filteredSections.map((s) => s.id));
    }
    return manualExpandedSections;
  }, [search, filteredSections, manualExpandedSections]);

  const toggleSection = (id: string) => {
    setManualExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setManualExpandedSections(new Set(GUIDE_SECTIONS.map((s) => s.id)));
  const collapseAll = () => setManualExpandedSections(new Set());

  const navigateTo = (id: string) => {
    // Make sure the parent section is expanded
    const section = GUIDE_SECTIONS.find(
      (s) => s.id === id || s.subsections?.some((sub) => sub.id === id)
    );
    if (section) {
      setManualExpandedSections((prev) => new Set([...prev, section.id]));
    }
    // Scroll to element after a brief delay to allow expansion
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  return (
    <div className="flex gap-8 max-w-7xl mx-auto" ref={contentRef}>
      {/* Sidebar — Table of Contents (hidden on small screens) */}
      <aside className="hidden xl:block w-64 shrink-0">
        <div className="sticky top-6 space-y-6">
          <TableOfContents onNavigate={navigateTo} />
          <Separator />
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 text-xs"
              onClick={() => window.print()}
            >
              <Printer className="size-3.5" />
              Print Guide
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-nmh-teal/10">
              <BookOpen className="size-5 text-nmh-teal" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-nmh-gray">Developer Guide</h1>
              <p className="text-sm text-muted-foreground">
                Technical documentation for maintaining and extending the NMH EMS Dashboard
              </p>
            </div>
          </div>
        </div>

        {/* Intro card */}
        <Card className="border-nmh-teal/30 bg-nmh-teal/[0.02]">
          <CardContent className="py-4 px-6">
            <p className="text-sm text-muted-foreground leading-relaxed">
              This guide documents the architecture, patterns, conventions, and known quirks of the
              codebase. It exists for continuity — if the original developer is unavailable, a
              successor should be able to understand and maintain the application using this
              document, the inline code comments, and the Prisma schema.
            </p>
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span>
                <strong className="text-foreground">{GUIDE_SECTIONS.length}</strong> sections
              </span>
              <span>
                <strong className="text-foreground">
                  {GUIDE_SECTIONS.reduce((n, s) => n + (s.subsections?.length ?? 0), 0)}
                </strong>{" "}
                topics
              </span>
              <span>
                Last updated: <strong className="text-foreground">Feb 2026</strong>
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Search + controls */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search the developer guide..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={expandAll}>
            Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Collapse All
          </Button>
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {filteredSections.length > 0 ? (
            filteredSections.map((section) => (
              <SectionCard
                key={section.id}
                section={section}
                isExpanded={expandedSections.has(section.id)}
                onToggle={() => toggleSection(section.id)}
                searchQuery={search}
              />
            ))
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground text-sm">
                No sections match &ldquo;{search}&rdquo;
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Back to top */}
      {showBackToTop && (
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-6 right-6 z-50 shadow-lg"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <ArrowUp className="size-4" />
        </Button>
      )}
    </div>
  );
}
