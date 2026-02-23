"use client";

import { useState, useMemo } from "react";
import {
  BookOpen,
  ExternalLink,
  Search,
  Lightbulb,
  Stethoscope,
  BarChart3,
  RefreshCcw,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type ResourceCategory,
  RESOURCE_CATEGORIES,
  QI_RESOURCES,
  searchResources,
  type QIResource,
} from "@/lib/qi-resources";

// ---------------------------------------------------------------------------
// Category icon mapping
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<ResourceCategory, React.ReactNode> = {
  ihi: <Lightbulb className="h-4 w-4" />,
  "ems-standards": <Stethoscope className="h-4 w-4" />,
  spc: <BarChart3 className="h-4 w-4" />,
  pdsa: <RefreshCcw className="h-4 w-4" />,
  measurement: <TrendingUp className="h-4 w-4" />,
  leadership: <Users className="h-4 w-4" />,
};

// ---------------------------------------------------------------------------
// Resource Card
// ---------------------------------------------------------------------------

function ResourceCard({ resource }: { resource: QIResource }) {
  return (
    <Card className="hover:border-nmh-teal/40 transition-colors">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-foreground">{resource.title}</h3>
              {resource.url && (
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-nmh-teal hover:text-nmh-teal/80 transition-colors shrink-0"
                  title="Open external link"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{resource.organization}</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">{resource.description}</p>

        {resource.keyPoints && resource.keyPoints.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-nmh-gray flex items-center gap-1">
              <Lightbulb className="h-3 w-3 text-nmh-teal" />
              Key Points
            </p>
            <ul className="space-y-1">
              {resource.keyPoints.map((point, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-nmh-teal/50 shrink-0" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}

        {resource.tags && resource.tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {resource.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function QIResourcesContent() {
  const [search, setSearch] = useState("");

  const filteredResources = useMemo(() => {
    if (!search.trim()) return null;
    return searchResources(search);
  }, [search]);

  const isSearching = search.trim().length > 0;

  const categories = Object.entries(RESOURCE_CATEGORIES) as [
    ResourceCategory,
    (typeof RESOURCE_CATEGORIES)[ResourceCategory],
  ][];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-nmh-gray flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-nmh-teal" />
            QI Resources
          </h1>
          <p className="text-muted-foreground mt-1">
            Curated quality improvement standards, guides, and best practices from leading
            organizations.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search resources..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Search results */}
      {isSearching ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {filteredResources?.length ?? 0} result
            {(filteredResources?.length ?? 0) !== 1 ? "s" : ""} for &ldquo;{search}&rdquo;
          </p>
          {filteredResources && filteredResources.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredResources.map((resource) => (
                <ResourceCard key={resource.id} resource={resource} />
              ))}
            </div>
          ) : (
            <div className="bg-card rounded-lg border p-8 text-center text-muted-foreground text-sm">
              No resources match your search.
            </div>
          )}
        </div>
      ) : (
        /* Category tabs */
        <Tabs defaultValue="ihi">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0">
            {categories.map(([key, meta]) => (
              <TabsTrigger
                key={key}
                value={key}
                className="flex items-center gap-1.5 text-xs data-[state=active]:bg-nmh-teal/10 data-[state=active]:text-nmh-teal"
              >
                {CATEGORY_ICONS[key]}
                {meta.label}
                <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-0.5">
                  {QI_RESOURCES.filter((r) => r.category === key).length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {categories.map(([key, meta]) => {
            const resources = QI_RESOURCES.filter((r) => r.category === key);
            return (
              <TabsContent key={key} value={key} className="space-y-4 mt-4">
                <div className="bg-muted/30 rounded-lg p-4 border">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {meta.description}
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {resources.map((resource) => (
                    <ResourceCard key={resource.id} resource={resource} />
                  ))}
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}
