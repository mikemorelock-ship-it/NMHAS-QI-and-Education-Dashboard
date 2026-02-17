"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/actions/auth";
import {
  hasAdminPermission,
  ADMIN_ROLE_LABELS,
  type AdminRole,
  type AdminPermission,
} from "@/lib/permissions";
import {
  LayoutDashboard,
  Building2,
  BarChart3,
  ClipboardList,
  PenLine,
  Users,
  LogOut,
  Eye,
  ArrowLeft,
  FileUp,
  GitBranchPlus,
  RefreshCcw,
  GraduationCap,
  HelpCircle,
  Shield,
  Target,
  ListChecks,
  Wand2,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: AdminPermission;
}

interface NavGroup {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

type NavEntry = NavItem | NavGroup;

function isNavGroup(entry: NavEntry): entry is NavGroup {
  return "items" in entry;
}

// ---------------------------------------------------------------------------
// Navigation structure
// ---------------------------------------------------------------------------

const navEntries: NavEntry[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, permission: "view_admin" },
  { href: "/admin/departments", label: "Divisions & Depts", icon: Building2, permission: "manage_departments" },
  { href: "/admin/metrics", label: "Metrics", icon: BarChart3, permission: "manage_metric_defs" },
  { href: "/admin/scorecards", label: "Scorecards", icon: ClipboardList, permission: "manage_scorecards" },
  {
    label: "Quality Improvement",
    icon: Target,
    items: [
      { href: "/admin/qi-workflow", label: "Workflow", icon: Wand2, permission: "manage_campaigns" },
      { href: "/admin/campaigns", label: "Campaigns", icon: Target, permission: "manage_campaigns" },
      { href: "/admin/driver-diagrams", label: "Diagrams", icon: GitBranchPlus, permission: "manage_driver_diagrams" },
      { href: "/admin/pdsa-cycles", label: "PDSA Cycles", icon: RefreshCcw, permission: "manage_driver_diagrams" },
      { href: "/admin/action-items", label: "Actions", icon: ListChecks, permission: "manage_action_items" },
    ],
  },
  { href: "/admin/field-training", label: "Field Training", icon: GraduationCap, permission: "manage_ftos_trainees" },
  { href: "/admin/data-entry", label: "Data Entry", icon: PenLine, permission: "enter_metric_data" },
  { href: "/admin/upload", label: "Upload Data", icon: FileUp, permission: "upload_batch_data" },
  { href: "/admin/resources", label: "Resources", icon: Users, permission: "manage_departments" },
  { href: "/admin/users", label: "Admin Users", icon: Shield, permission: "manage_users" },
  { href: "/admin/help", label: "Help", icon: HelpCircle, permission: "view_admin" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AdminSidebarProps {
  userRole: AdminRole;
  userName: string;
  pendingApprovals?: number;
}

export function AdminSidebar({
  userRole,
  userName,
  pendingApprovals = 0,
}: AdminSidebarProps) {
  const pathname = usePathname();

  // Auto-expand groups that contain the active route
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const entry of navEntries) {
      if (isNavGroup(entry)) {
        if (
          entry.items.some(
            (item) =>
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href))
          )
        ) {
          initial.add(entry.label);
        }
      }
    }
    return initial;
  });

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const isItemActive = (href: string) =>
    pathname === href || (href !== "/admin" && pathname.startsWith(href));

  const renderNavLink = (item: NavItem) => {
    const isActive = isItemActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-primary"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        )}
      >
        <item.icon className="h-4 w-4" />
        {item.label}
        {item.href === "/admin/users" && pendingApprovals > 0 && (
          <Badge className="ml-auto bg-nmh-orange text-white text-xs px-1.5 py-0.5 min-w-[20px] text-center">
            {pendingApprovals}
          </Badge>
        )}
      </Link>
    );
  };

  return (
    <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col shrink-0 h-screen sticky top-0">
      <div className="p-6 border-b border-sidebar-border space-y-3 shrink-0">
        <h1 className="text-lg font-bold tracking-tight">
          <span className="text-nmh-teal">NMH</span> EMS Dashboard
        </h1>
        <p className="text-xs text-sidebar-foreground/60">
          Admin Portal
        </p>
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-nmh-teal/10 text-nmh-teal hover:bg-nmh-teal/20 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navEntries.map((entry) => {
          if (isNavGroup(entry)) {
            // Filter children by permission
            const visibleChildren = entry.items.filter((item) =>
              hasAdminPermission(userRole, item.permission)
            );
            if (visibleChildren.length === 0) return null;

            const isExpanded = expandedGroups.has(entry.label);
            const hasActiveChild = visibleChildren.some((item) =>
              isItemActive(item.href)
            );

            return (
              <div key={entry.label}>
                <button
                  onClick={() => toggleGroup(entry.label)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full",
                    hasActiveChild
                      ? "text-sidebar-primary"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <entry.icon className="h-4 w-4" />
                  {entry.label}
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 ml-auto transition-transform",
                      !isExpanded && "-rotate-90"
                    )}
                  />
                </button>
                {isExpanded && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-2">
                    {visibleChildren.map(renderNavLink)}
                  </div>
                )}
              </div>
            );
          }

          // Regular nav item — filter by permission
          if (!hasAdminPermission(userRole, entry.permission)) return null;
          return renderNavLink(entry);
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border space-y-2 shrink-0">
        {/* User info */}
        <div className="px-3 py-2">
          <p className="text-sm font-medium text-sidebar-foreground truncate">
            {userName}
          </p>
          <Badge
            variant="outline"
            className="mt-1 text-xs border-sidebar-border text-sidebar-foreground/60"
          >
            {ADMIN_ROLE_LABELS[userRole]}
          </Badge>
        </div>

        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
        >
          <Eye className="h-4 w-4" />
          View Dashboard
        </Link>
        <form action={logoutAction}>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 px-3 py-2.5 text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </form>
      </div>
    </aside>
  );
}
