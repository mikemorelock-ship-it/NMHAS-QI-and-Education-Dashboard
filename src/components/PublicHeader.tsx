"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Settings,
  ClipboardList,
  LayoutDashboard,
  GitBranchPlus,
  GraduationCap,
  HelpCircle,
  LogOut,
  User,
} from "lucide-react";
import { NMH_COLORS } from "@/lib/constants";
import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";

interface PublicHeaderProps {
  userName: string;
  userRole: string;
}

export function PublicHeader({ userName, userRole }: PublicHeaderProps) {
  const pathname = usePathname();

  const showAdmin = ["admin", "manager", "data_entry"].includes(userRole);

  return (
    <header
      className="w-full h-14 flex-shrink-0 flex items-center px-4 md:px-6 gap-4 overflow-hidden"
      style={{ backgroundColor: NMH_COLORS.teal }}
    >
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-white font-bold text-base md:text-lg tracking-tight whitespace-nowrap">
          North Memorial Health
        </span>
        <span className="hidden lg:inline text-white/70 text-sm font-medium whitespace-nowrap">
          EMS Dashboard
        </span>
      </div>
      <nav className="flex items-center gap-1 ml-auto overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <Link
          href="/"
          aria-current={pathname === "/" ? "page" : undefined}
          className={
            "inline-flex items-center gap-1.5 min-h-9 px-3 rounded-lg text-sm font-medium transition-colors touch-manipulation shrink-0 " +
            (pathname === "/"
              ? "text-white bg-white/20"
              : "text-white/80 hover:text-white hover:bg-white/15")
          }
          title="Metrics Dashboard"
        >
          <LayoutDashboard className="size-4" aria-hidden="true" />
          <span className="hidden md:inline">Metrics Dashboard</span>
        </Link>
        <Link
          href="/scorecards"
          aria-current={pathname === "/scorecards" ? "page" : undefined}
          className={
            "inline-flex items-center gap-1.5 min-h-9 px-3 rounded-lg text-sm font-medium transition-colors touch-manipulation shrink-0 " +
            (pathname === "/scorecards"
              ? "text-white bg-white/20"
              : "text-white/80 hover:text-white hover:bg-white/15")
          }
          title="Scorecards"
        >
          <ClipboardList className="size-4" aria-hidden="true" />
          <span className="hidden md:inline">Scorecards</span>
        </Link>
        <Link
          href="/quality-improvement"
          aria-current={pathname.startsWith("/quality-improvement") ? "page" : undefined}
          className={
            "inline-flex items-center gap-1.5 min-h-9 px-3 rounded-lg text-sm font-medium transition-colors touch-manipulation shrink-0 " +
            (pathname.startsWith("/quality-improvement")
              ? "text-white bg-white/20"
              : "text-white/80 hover:text-white hover:bg-white/15")
          }
          title="Quality Improvement"
        >
          <GitBranchPlus className="size-4" aria-hidden="true" />
          <span className="hidden md:inline">QI Tools</span>
        </Link>
        <Link
          href="/field-training"
          aria-current={pathname.startsWith("/field-training") ? "page" : undefined}
          className={
            "inline-flex items-center gap-1.5 min-h-9 px-3 rounded-lg text-sm font-medium transition-colors touch-manipulation shrink-0 " +
            (pathname.startsWith("/field-training")
              ? "text-white bg-white/20"
              : "text-white/80 hover:text-white hover:bg-white/15")
          }
          title="Field Training"
        >
          <GraduationCap className="size-4" aria-hidden="true" />
          <span className="hidden md:inline">Field Training</span>
        </Link>
        <Link
          href="/help"
          aria-current={pathname === "/help" ? "page" : undefined}
          className={
            "inline-flex items-center gap-1.5 min-h-9 px-3 rounded-lg text-sm font-medium transition-colors touch-manipulation shrink-0 " +
            (pathname === "/help"
              ? "text-white bg-white/20"
              : "text-white/80 hover:text-white hover:bg-white/15")
          }
          title="Help"
        >
          <HelpCircle className="size-4" aria-hidden="true" />
          <span className="hidden md:inline">Help</span>
        </Link>
        <div className="w-px h-5 bg-white/20 mx-1 shrink-0" aria-hidden="true" />
        {showAdmin && (
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 min-h-9 px-3 rounded-lg text-sm font-medium text-white/80 hover:text-white hover:bg-white/15 transition-colors touch-manipulation shrink-0"
            title="Admin Portal"
          >
            <Settings className="size-4" aria-hidden="true" />
            <span className="hidden md:inline">Admin</span>
          </Link>
        )}
        <div className="w-px h-5 bg-white/20 mx-1 shrink-0" aria-hidden="true" />
        <span className="hidden lg:inline text-white/60 text-xs whitespace-nowrap shrink-0">
          {userName}
        </span>
        <form action={logoutAction} className="shrink-0">
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="text-white/80 hover:text-white hover:bg-white/15"
          >
            <LogOut className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline ml-1">Sign Out</span>
          </Button>
        </form>
      </nav>
    </header>
  );
}
