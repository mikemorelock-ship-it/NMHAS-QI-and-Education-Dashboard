"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  LogOut,
  HelpCircle,
  Users,
  ClipboardCheck,
  BookOpen,
  Camera,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NMH_COLORS } from "@/lib/constants";
import { logoutAction } from "@/actions/auth";
import { hasPermission } from "@/lib/permissions";
import type { Session } from "@/lib/auth";

interface FieldTrainingNavbarProps {
  session: Session;
  userName: string;
}

export function FieldTrainingNavbar({ session, userName }: FieldTrainingNavbarProps) {
  const pathname = usePathname();

  const isFto = session.role !== "trainee";
  const isTrainee = session.role === "trainee";
  const canReviewDors = isFto && hasPermission(session.role, "review_approve_dors");
  const canViewAllTrainees = isFto && hasPermission(session.role, "view_all_trainees");
  const showAdmin = ["admin", "manager", "data_entry"].includes(session.role);

  return (
    <header
      className="w-full h-14 flex-shrink-0 flex items-center justify-between px-4 md:px-8"
      style={{ backgroundColor: NMH_COLORS.teal }}
    >
      <div className="flex items-center gap-3">
        <span className="text-white font-bold text-lg tracking-tight">NMH</span>
        <span className="text-white/70 text-sm font-medium">Field Training</span>
        <span className="hidden md:inline text-white/50 text-xs">{userName}</span>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/fieldtraining"
          aria-current={pathname === "/fieldtraining" ? "page" : undefined}
          className={
            "inline-flex items-center gap-1.5 min-h-9 px-3 rounded-lg text-sm font-medium transition-colors " +
            (pathname === "/fieldtraining"
              ? "text-white bg-white/20"
              : "text-white/80 hover:text-white hover:bg-white/15")
          }
        >
          <LayoutDashboard className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Dashboard</span>
        </Link>
        <Link
          href="/fieldtraining/dors"
          aria-current={pathname.startsWith("/fieldtraining/dors") ? "page" : undefined}
          className={
            "inline-flex items-center gap-1.5 min-h-9 px-3 rounded-lg text-sm font-medium transition-colors " +
            (pathname.startsWith("/fieldtraining/dors")
              ? "text-white bg-white/20"
              : "text-white/80 hover:text-white hover:bg-white/15")
          }
        >
          <FileText className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">My DORs</span>
        </Link>

        {/* Trainee only: My Skills */}
        {isTrainee && (
          <Link
            href="/fieldtraining/skills"
            aria-current={pathname.startsWith("/fieldtraining/skills") ? "page" : undefined}
            className={
              "inline-flex items-center gap-1.5 min-h-9 px-3 rounded-lg text-sm font-medium transition-colors " +
              (pathname.startsWith("/fieldtraining/skills")
                ? "text-white bg-white/20"
                : "text-white/80 hover:text-white hover:bg-white/15")
            }
          >
            <ClipboardCheck className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">My Skills</span>
          </Link>
        )}

        {/* Trainee only: Coaching Activities */}
        {isTrainee && (
          <Link
            href="/fieldtraining/coaching"
            aria-current={pathname.startsWith("/fieldtraining/coaching") ? "page" : undefined}
            className={
              "inline-flex items-center gap-1.5 min-h-9 px-3 rounded-lg text-sm font-medium transition-colors " +
              (pathname.startsWith("/fieldtraining/coaching")
                ? "text-white bg-white/20"
                : "text-white/80 hover:text-white hover:bg-white/15")
            }
          >
            <BookOpen className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Coaching</span>
          </Link>
        )}

        {/* Supervisor/Manager: Team DORs */}
        {canReviewDors && (
          <Link
            href="/fieldtraining/team-dors"
            aria-current={pathname.startsWith("/fieldtraining/team-dors") ? "page" : undefined}
            className={
              "inline-flex items-center gap-1.5 min-h-9 px-3 rounded-lg text-sm font-medium transition-colors " +
              (pathname.startsWith("/fieldtraining/team-dors")
                ? "text-white bg-white/20"
                : "text-white/80 hover:text-white hover:bg-white/15")
            }
          >
            <ClipboardCheck className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Team DORs</span>
          </Link>
        )}

        {/* Supervisor/Manager: All Trainees */}
        {canViewAllTrainees && (
          <Link
            href="/fieldtraining/trainees"
            aria-current={pathname.startsWith("/fieldtraining/trainees") ? "page" : undefined}
            className={
              "inline-flex items-center gap-1.5 min-h-9 px-3 rounded-lg text-sm font-medium transition-colors " +
              (pathname.startsWith("/fieldtraining/trainees")
                ? "text-white bg-white/20"
                : "text-white/80 hover:text-white hover:bg-white/15")
            }
          >
            <Users className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">All Trainees</span>
          </Link>
        )}

        {/* Supervisor/Manager: Trainee Snapshots */}
        {canViewAllTrainees && (
          <Link
            href="/fieldtraining/snapshots"
            aria-current={pathname.startsWith("/fieldtraining/snapshots") ? "page" : undefined}
            className={
              "inline-flex items-center gap-1.5 min-h-9 px-3 rounded-lg text-sm font-medium transition-colors " +
              (pathname.startsWith("/fieldtraining/snapshots")
                ? "text-white bg-white/20"
                : "text-white/80 hover:text-white hover:bg-white/15")
            }
          >
            <Camera className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Snapshots</span>
          </Link>
        )}

        <Link
          href="/fieldtraining/help"
          aria-current={pathname === "/fieldtraining/help" ? "page" : undefined}
          className={
            "inline-flex items-center gap-1.5 min-h-9 px-3 rounded-lg text-sm font-medium transition-colors " +
            (pathname === "/fieldtraining/help"
              ? "text-white bg-white/20"
              : "text-white/80 hover:text-white hover:bg-white/15")
          }
        >
          <HelpCircle className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Help</span>
        </Link>
        {showAdmin && (
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 min-h-9 px-3 rounded-lg text-sm font-medium text-white/80 hover:text-white hover:bg-white/15 transition-colors"
            title="Admin Portal"
          >
            <Settings className="size-4" aria-hidden="true" />
            <span className="hidden md:inline">Admin</span>
          </Link>
        )}
        <div className="w-px h-5 bg-white/20 mx-1" aria-hidden="true" />
        <form action={logoutAction}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="text-white/80 hover:text-white hover:bg-white/15"
          >
            <LogOut className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline ml-1.5">Sign Out</span>
          </Button>
        </form>
      </div>
    </header>
  );
}
